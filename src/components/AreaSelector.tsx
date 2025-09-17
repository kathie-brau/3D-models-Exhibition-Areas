import React from 'react';

export interface Area {
  id: string;
  name: string;
}

interface AreaSelectorProps {
  currentArea: string;
  onAreaChange: (areaId: string) => void;
  showExhibitorDetails: boolean;
  onToggleExhibitorDetails: (show: boolean) => void;
}

const otdTechDays2026Areas: Area[] = [
  { id: 'MainExhibitionHall', name: 'MainExhibitionHall' }
];

const otdEnergy2027Areas: Area[] = [
  { id: 'all_in_one', name: 'Exhibition OTD Energy' },
  { id: 'Hall_B_2', name: 'Exhibition Hall B' },
  { id: 'Hall_C', name: 'Exhibition Hall C' },
  { id: 'Hall_E_3', name: 'Exhibition Hall E' }
];

export default function AreaSelector({ currentArea, onAreaChange, showExhibitorDetails, onToggleExhibitorDetails }: AreaSelectorProps) {
  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '15px'
    }}>
      {/* OTD TechDays 2026 Panel */}
      <div style={{
        background: 'rgba(0,0,0,0.8)',
        padding: '15px',
        borderRadius: '8px',
        color: 'white'
      }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>OTD TechDays 2026</h3>
        {otdTechDays2026Areas.map(area => (
          <button
            key={area.id}
            onClick={() => onAreaChange(area.id)}
            style={{
              display: 'block',
              width: '100%',
              margin: '5px 0',
              padding: '8px 12px',
              border: 'none',
              borderRadius: '4px',
              background: currentArea === area.id ? '#66aaff' : '#444',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {area.name}
          </button>
        ))}
      </div>

      {/* OTD Energy 2027 Panel */}
      <div style={{
        background: 'rgba(0,0,0,0.8)',
        padding: '15px',
        borderRadius: '8px',
        color: 'white'
      }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>OTD Energy 2027</h3>
        {otdEnergy2027Areas.map(area => (
          <button
            key={area.id}
            onClick={() => onAreaChange(area.id)}
            style={{
              display: 'block',
              width: '100%',
              margin: '5px 0',
              padding: '8px 12px',
              border: 'none',
              borderRadius: '4px',
              background: currentArea === area.id ? '#66aaff' : '#444',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {area.name}
          </button>
        ))}
      </div>

      {/* Exhibitor Details Toggle */}
      <div style={{
        background: 'rgba(0,0,0,0.8)',
        padding: '15px',
        borderRadius: '8px',
        color: 'white'
      }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          fontSize: '14px',
          userSelect: 'none'
        }}>
          <input
            type="checkbox"
            checked={showExhibitorDetails}
            onChange={(e) => onToggleExhibitorDetails(e.target.checked)}
            style={{
              width: '16px',
              height: '16px',
              cursor: 'pointer'
            }}
          />
          Show Exhibitor Details
        </label>
      </div>
    </div>
  );
}
