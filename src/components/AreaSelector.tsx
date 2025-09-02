import React from 'react';

export interface Area {
  id: string;
  name: string;
}

interface AreaSelectorProps {
  currentArea: string;
  onAreaChange: (areaId: string) => void;
}

const areas: Area[] = [
  { id: 'area1', name: 'Main Exhibition Hall' },
  { id: 'area2', name: 'Technology Pavilion' },
  { id: 'area3', name: 'Innovation Zone' }
];

export default function AreaSelector({ currentArea, onAreaChange }: AreaSelectorProps) {
  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      zIndex: 1000,
      background: 'rgba(0,0,0,0.8)',
      padding: '15px',
      borderRadius: '8px',
      color: 'white'
    }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Exhibition Areas</h3>
      {areas.map(area => (
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
  );
}