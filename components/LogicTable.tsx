import React from 'react';

interface LogicGateData {
  function: string;
  w0: string;
  w1: string;
  w2: string;
  logic: string;
}

const logicGates: LogicGateData[] = [
  { function: 'AND', w0: '-3', w1: '0.5', w2: '0.5', logic: 'Only outputs 1 if both inputs are 1.' },
  { function: 'OR', w0: '-0.3', w1: '0.5', w2: '0.5', logic: 'Outputs 1 if at least one input is 1.' },
  { function: 'NAND', w0: '3', w1: '-0.5', w2: '-0.5', logic: 'Negation of AND.' },
  { function: 'NOR', w0: '0.3', w1: '-0.5', w2: '-0.5', logic: 'Negation of OR.' },
];

const LogicTable: React.FC = () => {
  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="bg-[#0f172a] rounded-[2rem] border border-slate-800/50 overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800/50 bg-slate-900/20">
              <th className="px-10 py-8 text-[12px] font-black text-slate-400 uppercase tracking-[0.2em]">Function</th>
              <th className="px-10 py-8 text-[12px] font-black text-slate-400 uppercase tracking-[0.2em]">$W_0$ (THRESHOLD)</th>
              <th className="px-10 py-8 text-[12px] font-black text-slate-400 uppercase tracking-[0.2em]">$W_1$</th>
              <th className="px-10 py-8 text-[12px] font-black text-slate-400 uppercase tracking-[0.2em]">$W_2$</th>
              <th className="px-10 py-8 text-[12px] font-black text-slate-400 uppercase tracking-[0.2em]">Logic</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/30">
            {logicGates.map((gate, index) => (
              <tr key={index} className="hover:bg-white/[0.01] transition-colors">
                <td className="px-10 py-10">
                  <span className="text-indigo-400 font-black text-base tracking-widest border-b-2 border-indigo-400/20 pb-1">
                    {gate.function}
                  </span>
                </td>
                <td className="px-10 py-10 text-white font-bold text-base">
                  {gate.w0}
                </td>
                <td className="px-10 py-10 text-white font-bold text-base">
                  {gate.w1}
                </td>
                <td className="px-10 py-10 text-white font-bold text-base">
                  {gate.w2}
                </td>
                <td className="px-10 py-10 text-slate-200 font-bold text-base leading-relaxed max-w-xs">
                  {gate.logic}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LogicTable;
