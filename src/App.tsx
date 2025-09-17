import React, { useState } from 'react';
import WebGLScene from './WebGLScene';
import AreaSelector from './components/AreaSelector';
import BoothStatus from './components/BoothStatus';
import { useAreaData } from './hooks/useAreaData';
import './App.css';

const App: React.FC = () => {
  const [currentArea, setCurrentArea] = useState<string>('Hall_C');
  const [showExhibitorDetails, setShowExhibitorDetails] = useState<boolean>(false);
  const { data: areaData, loading, error } = useAreaData(currentArea);

  if (loading) {
    return (
      <div className="App" style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        Loading {currentArea}...
      </div>
    );
  }

  if (error) {
    return (
      <div className="App" style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: 'red'
      }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div className="App" style={{ position: 'relative', height: '100vh' }}>
      <AreaSelector 
        currentArea={currentArea} 
        onAreaChange={setCurrentArea}
        showExhibitorDetails={showExhibitorDetails}
        onToggleExhibitorDetails={setShowExhibitorDetails}
      />
      <BoothStatus areaData={areaData} />
      <WebGLScene 
        areaData={areaData} 
        currentArea={currentArea}
        showExhibitorDetails={showExhibitorDetails}
      />
    </div>
  );
}

export default App;
