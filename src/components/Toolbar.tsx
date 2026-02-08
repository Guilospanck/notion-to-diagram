'use client';

interface ToolbarProps {
  onFitView: () => void;
  onToggleMinimap: () => void;
  onRelayout: (direction: 'TB' | 'LR') => void;
  showMinimap: boolean;
}

export default function Toolbar({
  onFitView,
  onToggleMinimap,
  onRelayout,
  showMinimap,
}: ToolbarProps) {
  const btn = 'px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors';
  const activeBtn = 'px-3 py-1.5 text-sm rounded border border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 transition-colors';

  return (
    <div className="flex gap-2 flex-wrap">
      <button className={btn} onClick={onFitView}>Fit View</button>
      <button className={showMinimap ? activeBtn : btn} onClick={onToggleMinimap}>
        Minimap
      </button>
      <button className={btn} onClick={() => onRelayout('TB')}>Vertical</button>
      <button className={btn} onClick={() => onRelayout('LR')}>Horizontal</button>
    </div>
  );
}
