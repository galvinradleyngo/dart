import fs from 'fs';
import path from 'path';

const filePath = path.resolve(process.cwd(), 'src', 'App.jsx');

const snippet = `          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2 px-1">
            <h2 className="font-semibold flex items-center gap-2">
              <Calendar size={18} /> Milestones
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {!milestonesCollapsed && (
                <div className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2 shadow-sm">
                  <Filter size={16} className="text-black/50"/>
                  <select
                    value={milestoneFilter}
                    onChange={e => setMilestoneFilter(e.target.value)}
                    className="text-sm outline-none bg-transparent"
                  >
                    <option value="all">All milestones</option>
                    {milestones.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!milestonesCollapsed && (
                <button
                  onClick={() => addMilestone()}
                  className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"
                >
                  <Plus size={16}/> Add Milestone
                </button>
              )}
              <button
                onClick={() => setMilestonesCollapsed(v => !v)}
                title={milestonesCollapsed ? 'Expand Milestones' : 'Collapse Milestones'}
                aria-label={milestonesCollapsed ? 'Expand milestones' : 'Collapse milestones'}
                aria-expanded={!milestonesCollapsed}
                  className="inline-flex items-center justify-center w-11 h-11 rounded-full border border-black/10 bg-white text-slate-600 hover:bg-slate-50"
              >
                {milestonesCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
            </div>
          </div>
`;

const startMarker = '          <div className="flex flex-col';
const endMarker = '          <p className="text-sm text-slate-500 mt-1">';

let content = fs.readFileSync(filePath, 'utf8');
const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
  const block = content.slice(startIdx, endIdx);
  if (/<<<<<<<|=======|>>>>>>>/.test(block)) {
    content = content.slice(0, startIdx) + snippet + content.slice(endIdx);
    fs.writeFileSync(filePath, content);
    console.log('Milestones section conflicts resolved.');
  } else {
    console.log('No conflict markers found in Milestones section.');
  }
} else {
  console.log('Milestones section not found.');
}
