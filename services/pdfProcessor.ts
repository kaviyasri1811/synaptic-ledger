
import { DocumentImage } from '../types';

declare const window: any;

if (typeof window !== 'undefined' && window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export const extractDataFromPDF = async (file: File): Promise<{ text: string; images: DocumentImage[] }> => {
  const pdfjsLib = window.pdfjsLib;
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  const images: DocumentImage[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    
    // Extract text
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
    
    // 1. Extract figures by rendering the page and cropping based on captions
    try {
      const items = textContent.items;
      const hasFigure = items.some((item: any) => item.str.trim().match(/^(Fig|Figure)\.?\s*\d+/i));
      
      if (hasFigure) {
        const viewport = page.getViewport({ scale: 3.0 }); // Increased scale for high-resolution zoom clarity
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({ canvasContext: ctx, viewport: viewport }).promise;
          
          for (let j = 0; j < items.length; j++) {
            const item = items[j];
            if (item.str.trim().match(/^(Fig|Figure)\.?\s*\d+/i)) {
              const [canvasX, canvasY] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
              
              let topBoundary = 0;
              // Look for a long line of text (paragraph) above the figure to find the true top boundary
              for (let k = j - 1; k >= 0; k--) {
                const prevItem = items[k];
                if (prevItem.str.trim().length > 30) { // Likely a paragraph line, not a diagram label
                  const [prevX, prevY] = viewport.convertToViewportPoint(prevItem.transform[4], prevItem.transform[5]);
                  if (canvasY - prevY > 50) {
                    topBoundary = prevY + 20;
                    break;
                  }
                }
              }
              
              const cropY = Math.max(0, topBoundary);
              const cropHeight = Math.max(100, canvasY - cropY + 40); 
              
              const cropX = canvas.width * 0.05;
              const cropWidth = canvas.width * 0.9;
              
              const cropCanvas = document.createElement('canvas');
              cropCanvas.width = cropWidth;
              cropCanvas.height = cropHeight;
              const cropCtx = cropCanvas.getContext('2d');
              
              if (cropCtx) {
                 cropCtx.fillStyle = 'white';
                 cropCtx.fillRect(0, 0, cropWidth, cropHeight);
                 cropCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
                 const base64 = cropCanvas.toDataURL('image/jpeg', 0.9);
                 
                 images.push({
                   id: `${file.name}-p${i}-fig${j}`,
                   data: base64,
                   pageNumber: i,
                   contextText: item.str + " " + item.str + " " + pageText // Boost score by repeating caption
                 });
              }
            }
          }
          
          // Free memory
          canvas.width = 0;
          canvas.height = 0;
        }
      }
    } catch (err) {
      console.warn(`Failed to crop figures from page ${i}`, err);
    }

    // 2. Extract individual embedded images
    try {
      const operatorList = await page.getOperatorList();
      const validImageTypes = [
        pdfjsLib.OPS.paintImageXObject, 
        pdfjsLib.OPS.paintInlineImageXObject,
        pdfjsLib.OPS.paintImageMaskXObject
      ];
      
      for (let j = 0; j < operatorList.fnArray.length; j++) {
        if (validImageTypes.includes(operatorList.fnArray[j])) {
          const imgName = operatorList.argsArray[j][0];
          const img = await page.objs.get(imgName);
          
          if (img && img.data && img.width > 50 && img.height > 50) {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              const imageData = ctx.createImageData(img.width, img.height);
              const data = img.data;
              const pixelCount = img.width * img.height;
              
              if (data.length === pixelCount * 3) {
                for (let k = 0; k < pixelCount; k++) {
                  imageData.data[k * 4] = data[k * 3];
                  imageData.data[k * 4 + 1] = data[k * 3 + 1];
                  imageData.data[k * 4 + 2] = data[k * 3 + 2];
                  imageData.data[k * 4 + 3] = 255;
                }
              } else if (data.length === pixelCount * 4) {
                imageData.data.set(data);
              } else if (data.length === pixelCount) {
                // Grayscale
                for (let k = 0; k < pixelCount; k++) {
                  imageData.data[k * 4] = data[k];
                  imageData.data[k * 4 + 1] = data[k];
                  imageData.data[k * 4 + 2] = data[k];
                  imageData.data[k * 4 + 3] = 255;
                }
              } else {
                continue;
              }
              
              ctx.putImageData(imageData, 0, 0);
              const base64 = canvas.toDataURL('image/png');
              
              images.push({
                id: `${file.name}-p${i}-i${j}-${Math.random().toString(36).substring(2, 7)}`,
                data: base64,
                pageNumber: i,
                contextText: pageText
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Failed to extract images from page ${i}`, err);
    }
  }
  
  return { text: fullText, images };
};

export const extractTextFromPDF = async (file: File): Promise<string> => {
  const { text } = await extractDataFromPDF(file);
  return text;
};
