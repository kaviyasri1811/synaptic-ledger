import mermaid from 'mermaid';

const code = `graph LR

subgraph Sub1 ["Linear Unit Process"]

  A["Input Components (x1, x2, ... xn)"] -- "Weights (w1, w2, ... wn)" --> B["Linear Combination (Σ wi * xi)"]

  B --> C["Output (o)"]

end

subgraph Sub2 ["Optimization Loop"]

  C -- "Compare with Target (t)" --> D["Error Function (E)"]

  D -- "Gradient Descent" --> E["Weight Update (Δwi)"]

  E -. "Adjust Weights" .-> A

end

style B fill:#f9f,stroke:#333,stroke-width:2px

style D fill:#fff,stroke:#f66,stroke-width:2px`;

async function test() {
  try {
    await mermaid.parse(code);
    console.log("Valid!");
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
