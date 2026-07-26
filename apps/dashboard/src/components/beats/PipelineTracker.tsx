import React from 'react';
import { Check, Clock, AlertCircle, PlayCircle, Loader2 } from 'lucide-react';

export type PipelineStepStatus = 'waiting' | 'in_progress' | 'approval_needed' | 'done' | 'error';

export interface PipelineStep {
  id: string;
  label: string;
  status: PipelineStepStatus;
  description?: string;
}

interface PipelineTrackerProps {
  steps: PipelineStep[];
  currentStepId: string | null;
  onStepClick: (stepId: string) => void;
}

const PipelineTracker: React.FC<PipelineTrackerProps> = ({ steps, currentStepId, onStepClick }) => {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Production Pipeline</h3>
        <span style={styles.badge}>HITL Mode</span>
      </div>
      <div style={styles.track}>
        {steps.map((step, index) => {
          const isActive = currentStepId === step.id;
          const isLast = index === steps.length - 1;
          
          let Icon = Clock;
          let color = '#9CA3AF'; // waiting
          let bg = '#F3F4F6';
          
          if (step.status === 'done') {
            Icon = Check;
            color = '#10B981';
            bg = '#ECFDF5';
          } else if (step.status === 'in_progress') {
            Icon = Loader2;
            color = '#3B82F6';
            bg = '#EFF6FF';
          } else if (step.status === 'approval_needed') {
            Icon = PlayCircle;
            color = '#F59E0B';
            bg = '#FFFBEB';
          } else if (step.status === 'error') {
            Icon = AlertCircle;
            color = '#EF4444';
            bg = '#FEF2F2';
          }

          return (
            <React.Fragment key={step.id}>
              <div 
                style={{
                  ...styles.step,
                  ...(isActive ? styles.activeStep : {}),
                  borderColor: isActive ? color : 'transparent'
                }}
                onClick={() => onStepClick(step.id)}
              >
                <div style={{...styles.iconWrapper, background: bg, color}}>
                  <Icon size={16} className={step.status === 'in_progress' ? 'animate-spin' : ''} />
                </div>
                <div style={styles.stepInfo}>
                  <span style={{...styles.stepLabel, color: isActive ? '#1F2937' : '#6B7280', fontWeight: isActive ? 700 : 500}}>
                    {step.label}
                  </span>
                  {step.status === 'approval_needed' && (
                    <span style={styles.actionRequiredText}>승인 대기중</span>
                  )}
                </div>
              </div>
              
              {!isLast && (
                <div style={styles.connector}>
                  <div style={{
                    ...styles.line, 
                    background: step.status === 'done' ? '#10B981' : '#E5E7EB'
                  }} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#FFFFFF',
    borderBottom: '1px solid #E5E7EB',
    padding: '16px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: '#1F2937',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    color: '#F59E0B',
    background: '#FFFBEB',
    padding: '2px 8px',
    borderRadius: 12,
    border: '1px solid #FDE68A'
  },
  track: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    overflowX: 'auto',
    paddingBottom: 4,
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    border: '2px solid transparent',
    transition: 'all 0.2s ease',
    minWidth: 140,
  },
  activeStep: {
    background: '#F9FAFB',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  stepLabel: {
    fontSize: 13,
  },
  actionRequiredText: {
    fontSize: 10,
    fontWeight: 600,
    color: '#F59E0B',
  },
  connector: {
    flex: 1,
    minWidth: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
  },
  line: {
    height: 2,
    width: '100%',
    borderRadius: 1,
  }
};

export default PipelineTracker;
