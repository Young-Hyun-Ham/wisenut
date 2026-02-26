import { useState, useEffect } from 'react';
import styles from '../../NodeController.module.css';
import { createFormElement } from '../../nodeFactory';
import * as backendService from '../../backendService';
import FormTemplateModal from '../../FormTemplateModal';
import useAlert from '../../hooks/useAlert';
import { formatDisplayKeys, parseDisplayKeys } from '../../utils/gridUtils';
import { useNodeController } from '../../hooks/useNodeController'; // 1. 훅 임포트

// ElementEditor 컴포넌트
function ElementEditor({ element, index, onUpdate, onDelete, onGridCellChange }) {
  // ... (ElementEditor 코드는 변경 없음)
  const handleInputChange = (field, value) => {
    onUpdate(index, { ...element, [field]: value });
  };

  // --- 💡 [추가] API 설정(중첩 객체)을 위한 핸들러 ---
  const handleApiConfigChange = (field, value) => {
    onUpdate(index, { 
      ...element, 
      apiConfig: { 
        ...element.apiConfig, 
        [field]: value 
      } 
    });
  };
  // --- 💡 [추가 끝] ---

  const handleValidationChange = (field, value) => {
    onUpdate(index, { ...element, validation: { ...element.validation, [field]: value } });
  };

  const handleOptionChange = (optIndex, value) => {
    const newOptions = [...element.options];
    newOptions[optIndex] = value;
    onUpdate(index, { ...element, options: newOptions });
  };

  const addOption = () => {
    const newOptions = [...(element.options || []), `Option ${ (element.options || []).length + 1 }`];
    onUpdate(index, { ...element, options: newOptions });
  };

  const deleteOption = (optIndex) => {
    const newOptions = element.options.filter((_, i) => i !== optIndex);
    onUpdate(index, { ...element, options: newOptions });
  };

  const [displayKeysString, setDisplayKeysString] = useState(() => formatDisplayKeys(element.displayKeys));
  
  useEffect(() => {
    setDisplayKeysString(formatDisplayKeys(element.displayKeys));
  }, [element.displayKeys]);


  return (
    <div className={styles.elementEditor}>
      <h4>Edit {element.type}</h4>
      <div className={styles.formGroup}>
        <label>Label</label>
        <input type="text" value={element.label || ''} onChange={(e) => handleInputChange('label', e.target.value)} />
      </div>
      <div className={styles.formGroup}>
        <label>Name (Slot Key)</label>
        <input type="text" value={element.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} />
      </div>

      {element.type === 'input' && (
        <>
          <div className={styles.formGroup}>
            <label>Default Value (Optional)</label>
            <input
              type="text"
              placeholder="Enter default value or {slot_name}"
              value={element.defaultValue || ''}
              onChange={(e) => handleInputChange('defaultValue', e.target.value)}
            />
            <p className={styles.instructionText} style={{ marginTop: '4px', fontSize: '0.75rem' }}>
              Use <code>{'{slotName}'}</code> to reference a slot value, otherwise treated as literal text.
            </p>
          </div>
          <div className={styles.formGroup}>
            <label>Placeholder</label>
            <input type="text" value={element.placeholder || ''} onChange={(e) => handleInputChange('placeholder', e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label>Validation</label>
            <select value={element.validation?.type || 'text'} onChange={(e) => handleValidationChange('type', e.target.value)}>
              <option value="text">Text</option>
              <option value="email">Email</option>
              <option value="phone number">Phone Number</option>
              <option value="custom">Custom (Regex)</option>
            </select>
          </div>
          {element.validation?.type === 'custom' && (
             <div className={styles.formGroup}>
              <label>Regex</label>
              <input type="text" value={element.validation?.regex || ''} onChange={(e) => handleValidationChange('regex', e.target.value)} />
            </div>
          )}
        </>
      )}

      {(element.type === 'checkbox' || element.type === 'dropbox') && (
        <>
          {element.type === 'dropbox' && (
            <div className={styles.formGroup}>
              <label>Options Slot</label>
              <input
                type="text"
                placeholder="Bind to array in slot"
                value={element.optionsSlot || ''}
                onChange={(e) => handleInputChange('optionsSlot', e.target.value)}
              />
            </div>
          )}
          <div className={styles.formGroup}>
            <label>Options (Fallback)</label>
            <div className={styles.repliesContainer}>
              {(element.options || []).map((opt, i) => (
                <div key={i} className={styles.quickReply}>
                  <input className={styles.quickReplyInput} value={opt} onChange={(e) => handleOptionChange(i, e.target.value)} disabled={!!element.optionsSlot} />
                  <button onClick={() => deleteOption(i)} className={styles.deleteReplyButton} disabled={!!element.optionsSlot}>×</button>
                </div>
              ))}
              <button onClick={addOption} className={styles.addReplyButton} disabled={!!element.optionsSlot}>+ Add Option</button>
            </div>
          </div>
        </>
      )}

      {/* --- 💡 [수정] 'search' 엘리먼트 설정 UI --- */}
      {element.type === 'search' && (
        <>
          <div className={styles.formGroup}>
            <label>Placeholder</label>
            <input 
              type="text" 
              value={element.placeholder || ''} 
              onChange={(e) => handleInputChange('placeholder', e.target.value)} 
            />
          </div>
          
          {/* --- 💡 [추가] API Method 선택 드롭다운 --- */}
          <div className={styles.formGroup}>
            <label>API Method</label>
            <select
              value={element.apiConfig?.method || 'POST'}
              onChange={(e) => handleApiConfigChange('method', e.target.value)}
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
            </select>
          </div>
          {/* --- 💡 [추가 끝] --- */}

          <div className={styles.formGroup}>
            <label>API URL</label>
            <input
              type="text"
              placeholder="https://api.example.com/search"
              value={element.apiConfig?.url || ''}
              onChange={(e) => handleApiConfigChange('url', e.target.value)}
            />
            {/* --- 💡 [추가] GET 방식일 때 URL 도움말 --- */}
            {(element.apiConfig?.method === 'GET') && (
              <p className={styles.instructionText} style={{ marginTop: '4px', fontSize: '0.75rem' }}>
                GET 요청 시, <code>{`{{value}}`}</code>를 URL에 직접 포함하세요.
                <br />
                예: <code>https://api.example.com/search?q={"{{"}value{`}}`}</code>
              </p>
            )}
            {/* --- 💡 [추가 끝] --- */}
          </div>
          
          {/* --- 💡 [추가] Headers (JSON) 입력란 --- */}
          <div className={styles.formGroup}>
            <label>Headers (JSON) <span style={{fontWeight: 'normal', color: '#888'}}>(Optional)</span></label>
            <textarea
              value={element.apiConfig?.headers || '{}'}
              onChange={(e) => handleApiConfigChange('headers', e.target.value)}
              rows={4}
            />
             <p className={styles.instructionText} style={{ marginTop: '4px', fontSize: '0.75rem' }}>
               Use <code>{`{{slotName}}`}</code> for dynamic values in JSON header strings.
            </p>
          </div>
          {/* --- 💡 [추가 끝] --- */}

          {/* --- 💡 [수정] 'POST' (또는 기본값)일 때만 Body Template 표시 --- */}
          {(element.apiConfig?.method !== 'GET') && (
            <div className={styles.formGroup}>
              <label>Body Template (JSON)</label>
              <textarea
                value={element.apiConfig?.bodyTemplate || '{"query": "{{value}}"}'}
                onChange={(e) => handleApiConfigChange('bodyTemplate', e.target.value)}
                rows={4}
              />
              <p className={styles.instructionText} style={{ marginTop: '4px', fontSize: '0.75rem' }}>
                Use <code>{`{{value}}`}</code> to insert the search term.
                You can also use other slots like <code>{`{{slotName}}`}</code>.
              </p>
            </div>
          )}
          {/* --- 💡 [수정 끝] --- */}

          {/* --- 👇 [추가] Input Fill Key 설정 --- */}
          <div className={styles.formGroup}>
            <label>Input Fill Key <span style={{fontWeight: 'normal', color: '#888'}}>(Optional)</span></label>
            <input
              type="text"
              placeholder="e.g., product_name or id"
              value={element.inputFillKey || ''}
              onChange={(e) => handleInputChange('inputFillKey', e.target.value)}
            />
            <p className={styles.instructionText} style={{ marginTop: '4px', fontSize: '0.75rem' }}>
              Key from the selected grid row to fill the search input field.
              (Defaults to the first column if empty)
            </p>
          </div>
          {/* --- 👆 [추가 끝] --- */}

          <div className={styles.formGroup}>
            <label>Result Slot</label>
            <input
              type="text"
              placeholder="e.g., search_results"
              value={element.resultSlot || ''}
              onChange={(e) => handleInputChange('resultSlot', e.target.value)}
            />
            <p className={styles.instructionText} style={{ marginTop: '4px', fontSize: '0.75rem' }}>
              The API response data will be stored in this slot.
              A Grid element can use this slot in its 'Data Slot' field.
            </p>
          </div>
        </>
      )}
      {/* --- 💡 [수정 끝] --- */}

      {element.type === 'grid' && (
        <>
          <div className={styles.formGroup}>
            <label>Data Slot</label>
            <input
              type="text"
              placeholder="Bind to array in slot"
              value={element.optionsSlot || ''}
              onChange={(e) => handleInputChange('optionsSlot', e.target.value)}
            />
          </div>
          {element.optionsSlot && (
            <>
                <div className={styles.formGroup}>
                    <label>Display Labels (comma-separated)</label>
                    <input
                        type="text"
                        placeholder="e.g., name(My Name),email"
                        value={displayKeysString}
                        onChange={(e) => {
                            setDisplayKeysString(e.target.value);
                        }}
                        onBlur={(e) => {
                            handleInputChange('displayKeys', parseDisplayKeys(e.target.value));
                        }}
                    />
                    <p className={styles.instructionText} style={{marginTop: '4px', fontSize: '0.75rem'}}>
                        Use <code>key(Label)</code> syntax. If <code>(Label)</code> is omitted, the key will be used as the label.
                    </p>
                </div>
                <div className={styles.formGroup}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={element.hideNullColumns || false}
                            onChange={(e) => handleInputChange('hideNullColumns', e.target.checked)}
                        />
                        Hide Columns with Null Values
                    </label>
                </div>
            </>
          )}
          {!element.optionsSlot && (
            <>
              <div className={styles.gridControls}>
                <div className={styles.formGroup}>
                  <label>Rows</label>
                  <input type="number" value={element.rows || 2} onChange={(e) => handleInputChange('rows', parseInt(e.target.value) || 1)} />
                </div>
                 <div className={styles.formGroup}>
                  <label>Columns</label>
                  <input type="number" value={element.columns || 2} onChange={(e) => handleInputChange('columns', parseInt(e.target.value) || 1)} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Grid Content (Fallback)</label>
                <div className={styles.gridContentEditor} style={{ gridTemplateColumns: `repeat(${element.columns || 2}, 1fr)`}}>
                  {Array.from({ length: (element.rows || 2) * (element.columns || 2) }).map((_, i) => {
                    const rowIndex = Math.floor(i / (element.columns || 2));
                    const colIndex = i % (element.columns || 2);
                    return (
                       <textarea
                        key={i}
                        className={styles.gridCellEditor}
                        value={element.data?.[i] || ''}
                        onChange={(e) => onGridCellChange(index, rowIndex, colIndex, e.target.value)}
                      />
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}

      <div className={styles.editorActions}>
        <button className={styles.deleteElementButton} onClick={() => onDelete(index)}>Delete Element</button>
      </div>
    </div>
  );
}

function FormNodeController({ localNode, setLocalNode }) {
    const [selectedElementId, setSelectedElementId] = useState(null);
    const [draggedItemIndex, setDraggedItemIndex] = useState(null);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [formTemplates, setFormTemplates] = useState([]);
    const { showAlert, showConfirm } = useAlert();
    // 2. 훅 사용
    const { handleLocalDataChange } = useNodeController(setLocalNode);

    useEffect(() => {
        const fetchTemplates = async () => {
          try {
            const templates = await backendService.fetchFormTemplates();
            setFormTemplates(templates);
          } catch (error) {
            console.error("Failed to fetch form templates:", error);
          }
        };
        fetchTemplates();
    }, []);

    // 3. 훅의 handleLocalDataChange를 사용하도록 로컬 함수들 수정
    const localAddElement = (elementType) => {
      const newElement = createFormElement(elementType);
      setLocalNode(prev => ({
        ...prev,
        data: {
          ...prev.data,
          elements: [...(prev.data.elements || []), newElement]
        }
      }));
    };

    const localUpdateElement = (elementIndex, elementUpdate) => {
      setLocalNode(prev => {
        const newElements = [...prev.data.elements];
        newElements[elementIndex] = { ...newElements[elementIndex], ...elementUpdate };
        return {
          ...prev,
          data: { ...prev.data, elements: newElements }
        };
      });
    };

    const localDeleteElement = (elementIndex) => {
      setLocalNode(prev => ({
        ...prev,
        data: {
          ...prev.data,
          elements: prev.data.elements.filter((_, i) => i !== elementIndex)
        }
      }));
    };

    const localMoveElement = (startIndex, endIndex) => {
        setLocalNode(prev => {
            const newElements = [...prev.data.elements];
            const [removed] = newElements.splice(startIndex, 1);
            newElements.splice(endIndex, 0, removed);
            return {
              ...prev,
              data: { ...prev.data, elements: newElements }
            };
        });
    };

    const localUpdateGridCell = (elementIndex, rowIndex, colIndex, value) => {
        setLocalNode(prev => {
            const newElements = JSON.parse(JSON.stringify(prev.data.elements));
            const gridElement = newElements[elementIndex];
            if (gridElement && gridElement.type === 'grid') {
              const index = rowIndex * gridElement.columns + colIndex;
              gridElement.data[index] = value;
              return {
                ...prev,
                data: { ...prev.data, elements: newElements }
              };
            }
            return prev;
        });
    };

    const handleSaveTemplate = async (templateName) => {
        const templateData = {
            name: templateName,
            title: localNode.data.title,
            elements: localNode.data.elements || [],
        };
        try {
            const savedTemplate = await backendService.saveFormTemplate(templateData);
            setFormTemplates(prev => [...prev, savedTemplate]);
            setIsTemplateModalOpen(false);
            await showAlert("Form template saved successfully!");
        } catch (error) {
            console.error("Failed to save form template:", error);
            await showAlert("Failed to save template.");
        }
    };

    const handleLoadTemplate = (template) => {
        setLocalNode(prev => ({
            ...prev,
            data: {
                ...prev.data,
                title: template.title,
                elements: template.elements,
            },
        }));
        setSelectedElementId(null);
        setIsTemplateModalOpen(false);
    };

    const handleDeleteTemplate = async (templateId) => {
        const confirmed = await showConfirm("Are you sure you want to delete this form template?");
        if (confirmed) {
            try {
                await backendService.deleteFormTemplate(templateId);
                setFormTemplates(prev => prev.filter(t => t.id !== templateId));
            } catch (error) {
                console.error("Failed to delete form template:", error);
                await showAlert("Failed to delete template.");
            }
        }
    };


    const handleDragStart = (e, index) => {
      setDraggedItemIndex(index);
    };

    const handleDragOver = (e, index) => {
      e.preventDefault();
    };

    const handleDragLeave = (e) => {
    };

    const handleDrop = (e, index) => {
      if (draggedItemIndex === null || draggedItemIndex === index) return;
      localMoveElement(draggedItemIndex, index);
      setDraggedItemIndex(null);
    };

    const { data } = localNode;
    // --- 💡 [수정] 'search' 탭 추가 ---
    const elementTabs = ['input', 'search', 'date', 'grid', 'checkbox', 'dropbox'];
    // --- 💡 [수정 끝] ---
    const elements = data.elements || [];
    const selectedElementIndex = elements.findIndex(el => el.id === selectedElementId);
    const selectedElement = selectedElementIndex > -1 ? elements[selectedElementIndex] : null;

  return (
    <>
      <FormTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSave={handleSaveTemplate}
        onSelect={handleLoadTemplate}
        onDelete={handleDeleteTemplate}
        templates={formTemplates}
      />
      <div className={styles.templateActions}>
        <button onClick={() => setIsTemplateModalOpen(true)}>Templates</button>
      </div>
      <div className={styles.separator} />

      <div className={styles.formGroup}>
        <label>Form Title</label>
        <input type="text" value={data.title || ''} onChange={(e) => handleLocalDataChange('title', e.target.value)} />
      </div>
      
      <div className={styles.formGroup} style={{paddingTop: 5, paddingBottom: 5}}>
        <label 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '0.85rem',
            color: '#555'
          }}
        >
            <input
                type="checkbox"
                checked={data.enableExcelUpload || false}
                onChange={(e) => handleLocalDataChange('enableExcelUpload', e.target.checked)}
                style={{ width: '16px', height: '16px', margin: 0, flexShrink: 0, accentColor: '#3498db' }}
            />
            Enable Excel Upload Button
        </label>
      </div>

      <div className={styles.formGroup}>
        <label>Add Element</label>
        <div className={styles.elementTabs}>
          {elementTabs.map(type => (
            <button key={type} onClick={() => localAddElement(type)}>{type}</button>
          ))}
        </div>
      </div>
      <div className={styles.separator} />
      <div className={styles.formGroup}>
        <label>Elements List</label>
        <div className={styles.elementsContainer}>
          {elements.length > 0 ? (
            elements.map((el, index) => (
              <div
                  key={el.id}
                  className={`${styles.elementItem} ${el.id === selectedElementId ? styles.selected : ''}`}
                  onClick={() => setSelectedElementId(el.id)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
              >
                <div className={styles.elementItemContent}>
                  <span>{el.label || el.type}</span>
                  <span className={styles.elementType}>({el.type})</span>
                </div>
                <button
                  className={styles.elementDeleteButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    localDeleteElement(index);
                    if (el.id === selectedElementId) {
                      setSelectedElementId(null);
                    }
                  }}
                >
                  ×
                </button>
              </div>
            ))
          ) : (
            <p className={styles.placeholder}>No elements added yet.</p>
          )}
        </div>
      </div>
      <div className={styles.separator} />
      {selectedElement && (
          <ElementEditor
              key={selectedElement.id}
              element={selectedElement}
              index={selectedElementIndex}
              onUpdate={localUpdateElement}
              onDelete={(index) => {
                localDeleteElement(index);
                setSelectedElementId(null);
              }}
              onGridCellChange={localUpdateGridCell}
          />
      )}
    </>
  );
}

export default FormNodeController;
