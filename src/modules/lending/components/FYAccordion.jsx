import { useState } from 'react';
import { getCurrentFYLabel } from '../../../utils/dateUtils';

/**
 * FYAccordion — renders grouped data as collapsible FY sections.
 *
 * Props:
 *   groupedData   — object keyed by FY label (e.g. { "2025-26": [...], "2024-25": [...] })
 *   renderSection — (fyLabel, items) => JSX — render the content for one FY section
 *   emptyMessage  — optional message when no groups exist
 */
export default function FYAccordion({ groupedData, renderSection, emptyMessage }) {
  const currentFY = getCurrentFYLabel();
  const fyLabels = Object.keys(groupedData);

  const [expanded, setExpanded] = useState(() => {
    // Current FY expanded by default; if no current FY data, expand the first (newest)
    if (fyLabels.includes(currentFY)) return new Set([currentFY]);
    if (fyLabels.length > 0) return new Set([fyLabels[0]]);
    return new Set();
  });

  const toggle = (fy) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(fy)) next.delete(fy);
      else next.add(fy);
      return next;
    });
  };

  if (fyLabels.length === 0) {
    return emptyMessage ? (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <p>{emptyMessage}</p>
      </div>
    ) : null;
  }

  return (
    <div className="fy-accordion">
      {fyLabels.map(fy => {
        const items = groupedData[fy];
        const isOpen = expanded.has(fy);
        const isCurrent = fy === currentFY;

        return (
          <div key={fy} className={`fy-section ${isCurrent ? 'fy-section-current' : ''}`}>
            <button
              className={`fy-header ${isOpen ? 'fy-header-open' : ''}`}
              onClick={() => toggle(fy)}
            >
              <span className="fy-header-arrow">{isOpen ? '▼' : '▶'}</span>
              <span className="fy-header-label">FY {fy}</span>
              <span className="fy-header-count">{items.length} {items.length === 1 ? 'entry' : 'entries'}</span>
              {isCurrent && <span className="fy-badge-current">Current</span>}
            </button>
            {isOpen && (
              <div className="fy-content">
                {renderSection(fy, items)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
