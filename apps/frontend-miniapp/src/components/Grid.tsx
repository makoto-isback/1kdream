import { useTranslation } from '../hooks/useTranslation';
import './Grid.css';

interface GridProps {
  selectedBlock: number | null;
  onSelectBlock: (block: number) => void;
}

export default function Grid({ selectedBlock, onSelectBlock }: GridProps) {
  const { t } = useTranslation();
  const blocks = Array.from({ length: 25 }, (_, i) => i + 1);

  return (
    <div className="block-selection">
      <h3>{t('bet.selectBlock')}</h3>
      <div className="blocks-grid">
        {blocks.map((block) => (
          <button
            key={block}
            className={`block-btn ${selectedBlock === block ? 'selected' : ''}`}
            onClick={() => onSelectBlock(block)}
          >
            {block.toString().padStart(2, '0')}
          </button>
        ))}
      </div>
    </div>
  );
}

