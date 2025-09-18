import React from 'react';
import { AreaData, BoothStatus as BoothStatusType } from '../types/booth';

interface BoothStatusProps {
  areaData: AreaData | null;
}

export default function BoothStatus({ areaData }: BoothStatusProps) {
  if (!areaData || !areaData.booths) return null;

  const statusCounts = areaData.booths.reduce((acc: Record<BoothStatusType, number>, booth) => {
    acc[booth.status] = (acc[booth.status] || 0) + 1;
    return acc;
  }, {} as Record<BoothStatusType, number>);

  const totalBooths = areaData.booths.length;
  const soldBooths = statusCounts.sold || 0;
  const reservedBooths = statusCounts.reserved || 0;
  const availableBooths = statusCounts.available || 0;

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      right: '20px',
      zIndex: 1000,
      background: 'rgba(0,0,0,0.8)',
      padding: '15px',
      borderRadius: '8px',
      color: 'white',
      minWidth: '200px'
    }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
        {areaData.areaName}
      </h3>
      <div style={{ fontSize: '14px' }}>
        <div style={{ margin: '5px 0' }}>
          <span style={{ color: '#66aaff' }}>●</span> Sold: {soldBooths}
        </div>
        <div style={{ margin: '5px 0' }}>
          <span style={{ color: '#ffaa66' }}>●</span> Reserved: {reservedBooths}
        </div>
        <div style={{ margin: '5px 0' }}>
          <span style={{ color: '#cccccc' }}>●</span> Available: {availableBooths}
        </div>
        <hr style={{ margin: '10px 0', border: '1px solid #444' }} />
        <div style={{ fontWeight: 'bold' }}>
          Total: {totalBooths} booths
        </div>
        <div style={{ fontSize: '12px', marginTop: '5px', color: '#aaa' }}>
          {Math.round((soldBooths / totalBooths) * 100)}% sold
        </div>
      </div>
    </div>
  );
}