import { useState, useEffect } from 'react';
import Flow from './Flow';
import ScenarioList from './ScenarioList';
import Board from './Board';
import ApiDocs from './ApiDocs';
import Admin from './Admin';
import HelpModal from './HelpModal';
import ScenarioModal from './ScenarioModal';
import useStore from './store';
import * as backendService from './backendService';
import { AlertProvider } from './context/AlertProvider';
import './App.css';

function App() {
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [view, setView] = useState('list');
  const [scenarios, setScenarios] = useState([]);
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  const fetchNodeColors = useStore((state) => state.fetchNodeColors);
  const fetchNodeTextColors = useStore((state) => state.fetchNodeTextColors);
  const fetchNodeVisibility = useStore((state) => state.fetchNodeVisibility);

  useEffect(() => {
    fetchNodeColors();
    fetchNodeTextColors();
    fetchNodeVisibility();
  }, [fetchNodeColors, fetchNodeTextColors, fetchNodeVisibility]);

  const handleScenarioSelect = (scenario) => {
    setSelectedScenario(scenario);
    setView('flow');
  };

  const handleOpenAddScenarioModal = () => {
    setEditingScenario(null);
    setIsScenarioModalOpen(true);
  };

  const handleOpenEditScenarioModal = (scenario) => {
    setEditingScenario(scenario);
    setIsScenarioModalOpen(true);
  };

  const handleSaveScenario = async ({ name, job, description }) => {
    try {
      if (editingScenario) {
        if (name !== editingScenario.name && scenarios.some((s) => s.name === name)) {
          alert('A scenario with that name already exists.');
          return;
        }
        await backendService.renameScenario({
          scenarioId: editingScenario.id,
          newName: name,
          job,
          description,
        });
        setScenarios((prev) => prev.map((s) => (s.id === editingScenario.id ? { ...s, name, job, description } : s)));
        alert('Scenario updated successfully.');
      } else {
        if (scenarios.some((s) => s.name === name)) {
          alert('A scenario with that name already exists.');
          return;
        }
        const newScenario = await backendService.createScenario({
          newScenarioName: name,
          job,
          description,
        });
        setScenarios((prev) => [...prev, { ...newScenario, lastUsedAt: null }]);
        setSelectedScenario({ ...newScenario, lastUsedAt: null });
        setView('flow');
        alert(`Scenario '${newScenario.name}' has been created.`);
      }
      setIsScenarioModalOpen(false);
      setEditingScenario(null);
    } catch (error) {
      console.error('Error saving scenario:', error);
      alert(`Failed to save scenario: ${error.message}`);
    }
  };

  const handleViewChange = (targetView) => {
    if (targetView === 'flow') {
      if (selectedScenario) {
        setView('flow');
      } else {
        handleOpenAddScenarioModal();
      }
    } else {
      setView(targetView);
    }
  };

  return (
    <AlertProvider>
      <div className="app-container">
        <header className="app-header">
          <div className="header-title-container">
            <h1>Chatbot Flow & Board</h1>
            <button className="help-button" onClick={() => setIsHelpModalOpen(true)}>
              ?
            </button>
          </div>
          <nav>
            <button onClick={() => handleViewChange('list')} className={view === 'list' ? 'active' : ''}>
              Scenario List
            </button>
            <button
              onClick={() => handleViewChange('flow')}
              className={view === 'flow' ? 'active' : ''}
              disabled={!selectedScenario && view !== 'flow'}
            >
              Flow Editor
            </button>
            <button onClick={() => handleViewChange('board')} className={view === 'board' ? 'active' : ''}>
              Board
            </button>
            <button onClick={() => handleViewChange('api')} className={view === 'api' ? 'active' : ''}>
              API Docs
            </button>
            <button onClick={() => handleViewChange('admin')} className={view === 'admin' ? 'active' : ''}>
              Admin
            </button>
          </nav>
        </header>
        <main className="app-main">
          <div className={`view-container ${view !== 'list' ? 'hidden' : ''}`}>
            <ScenarioList
              scenarios={scenarios}
              setScenarios={setScenarios}
              onSelect={handleScenarioSelect}
              onAddScenario={handleOpenAddScenarioModal}
              onEditScenario={handleOpenEditScenarioModal}
            />
          </div>
          <div className={`view-container ${view !== 'flow' ? 'hidden' : ''}`}>
            {selectedScenario ? (
              <Flow scenario={selectedScenario} scenarios={scenarios} />
            ) : (
              <p className="placeholder-text">Select or create a scenario to edit.</p>
            )}
          </div>
          <div className={`view-container ${view !== 'board' ? 'hidden' : ''}`}>
            {/* <Board /> */}
          </div>
          <div className={`view-container ${view !== 'api' ? 'hidden' : ''}`}>
            <ApiDocs />
          </div>
          <div className={`view-container ${view !== 'admin' ? 'hidden' : ''}`}>
            <Admin />
          </div>
        </main>
        <ScenarioModal
          isOpen={isScenarioModalOpen}
          scenario={editingScenario}
          onClose={() => {
            setIsScenarioModalOpen(false);
            setEditingScenario(null);
          }}
          onSave={handleSaveScenario}
        />
        <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
      </div>
    </AlertProvider>
  );
}

export default App;
