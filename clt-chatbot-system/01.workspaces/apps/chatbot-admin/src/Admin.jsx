import React from 'react';
import useStore, { ALL_NODE_TYPES } from './store';
import styles from './Admin.module.css';

function Admin() {
  const { 
    nodeColors, 
    setNodeColor, 
    nodeTextColors, 
    setNodeTextColor,
    visibleNodeTypes,
    setNodeVisibility
  } = useStore();

  const visibleSet = new Set(visibleNodeTypes);

  return (
    <div className={styles.adminContainer}>
      <h1>Admin Settings</h1>
      
      <section className={styles.settingsSection}>
        <h2>Node Type Management</h2>
        <p>Set colors and visibility for each node type in the 'Add Node' panel.</p>
        
        <div className={styles.settingsGrid}>
          {/* Grid Header */}
          <div className={styles.gridHeader}>Node Type</div>
          <div className={styles.gridHeader}>Background</div>
          <div className={styles.gridHeader}>Text</div>
          <div className={styles.gridHeader}>Visible</div>
          
          {/* Grid Rows */}
          {ALL_NODE_TYPES.map(type => (
            <React.Fragment key={type}>
              <div className={styles.gridCellLabel}>{type}</div>
              
              {/* Background Color */}
              <div className={styles.gridCell}>
                <input
                  type="color"
                  value={nodeColors[type]}
                  onChange={(e) => setNodeColor(type, e.target.value)}
                  className={styles.colorInput}
                />
                <span>{nodeColors[type]}</span>
              </div>
              
              {/* Text Color */}
              <div className={styles.gridCell}>
                <input
                  type="color"
                  value={nodeTextColors[type]}
                  onChange={(e) => setNodeTextColor(type, e.target.value)}
                  className={styles.colorInput}
                />
                 <span>{nodeTextColors[type]}</span>
              </div>
              
              {/* Visibility Checkbox */}
              <div className={styles.gridCell}>
                <input
                  type="checkbox"
                  checked={visibleSet.has(type)}
                  onChange={(e) => setNodeVisibility(type, e.target.checked)}
                  className={styles.checkboxInput}
                />
              </div>
            </React.Fragment>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Admin;
