import React from 'react';
import { jsPDF } from 'jspdf';
import { InterviewSession, AlertLog } from '../types';
import { X, ShieldAlert, Clock, BarChart3, Download, User } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

interface ReportViewProps {
  session: InterviewSession;
  alerts: AlertLog[];
  onClose: () => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ session, alerts, onClose }) => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN';
  const isHighRisk = session.cheatingScore > 40;
  
  // Group alerts by type for summary
  const alertSummary = alerts.reduce((acc, alert) => {
    acc[alert.type] = (acc[alert.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const [showExportOptions, setShowExportOptions] = React.useState(false);

  const getReportHtml = () => `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Audit Report - ${session.candidateName}</title>
        <style>
          body { font-family: sans-serif; line-height: 1.6; color: #333; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
          .title { color: #2563eb; font-size: 28px; font-weight: bold; margin: 0; }
          .section { margin-top: 30px; }
          .section-title { color: #1f2937; font-size: 18px; font-weight: bold; border-bottom: 1px solid #e5e7eb; margin-bottom: 15px; padding-bottom: 5px; }
          .metric-box { background-color: #f9fafb; padding: 20px; border-radius: 12px; margin: 15px 0; border: 1px solid #f3f4f6; }
          .risk-high { color: #dc2626; font-weight: bold; }
          .risk-low { color: #16a34a; font-weight: bold; }
          .footer { margin-top: 60px; font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { text-align: left; padding: 12px; border-bottom: 1px solid #eee; }
          th { background-color: #f8fafc; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; }
          .info-grid p { margin: 5px 0; }
          .info-label { font-weight: bold; color: #6b7280; width: 150px; display: inline-block; }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">PROCTOR AI AUDIT REPORT</h1>
          <p style="color: #6b7280;">Session Analytics & Integrity Verification</p>
        </div>

        <div class="section">
          <div class="section-title">1. CANDIDATE & SESSION OVERVIEW</div>
          <div class="info-grid">
            <p><span class="info-label">Candidate Name:</span> ${session.candidateName}</p>
            <p><span class="info-label">Session ID:</span> ${session.id}</p>
            <p><span class="info-label">Generated On:</span> ${new Date().toLocaleString()}</p>
          </div>
        </div>

        <div class="section">
          <div class="section-title">2. AI PERFORMANCE METRICS</div>
          <div class="metric-box">
            <p><strong>Integrity Score:</strong> ${Math.round(session.cheatingScore)}% Correctness</p>
            <p><strong>Risk Level:</strong> <span class="${session.cheatingScore > 40 ? 'risk-high' : 'risk-low'}">${session.cheatingScore > 40 ? 'CRITICAL RISK / REVIEW REQUIRED' : 'PASS / LOW RISK'}</span></p>
            <p><strong>Active Window:</strong> ${session.endTime ? Math.round((session.endTime - session.startTime) / 60000) : '--'} Minutes</p>
          </div>
        </div>

        <div class="section">
          <div class="section-title">3. SUSPICIOUS INCIDENT LOG</div>
          <p>Automated tracking recorded <strong>${alerts.length}</strong> behavioral flags.</p>
          <table>
            <thead>
              <tr>
                <th>Incident Type</th>
                <th>Count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(alertSummary).length > 0 
                ? Object.entries(alertSummary).map(([type, count]) => `
                  <tr>
                    <td>${type.replace(/_/g, ' ')}</td>
                    <td>${count}</td>
                    <td><span style="color: #ef4444;">Flagged</span></td>
                  </tr>`).join('')
                : '<tr><td colspan="3" style="text-align: center; color: #9ca3af;">No significant alerts recorded</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">4. AUDIT CONCLUSION</div>
          <p style="font-size: 16px; background-color: #fefce8; padding: 15px; border-radius: 8px; border: 1px solid #fef08a;">
            ${session.cheatingScore > 40 
              ? '<strong>NOTICE:</strong> High risk score detected. Patterns consistent with external assistance or unauthorized reference usage. Manual review is highly recommended.' 
              : '<strong>VERIFIED:</strong> Session parameters are within the standard range of integrity. The candidate maintained focus.'}
          </p>
        </div>

        <div class="footer">
          <p>Generated by InterviewMate AI Proctoring Engine • Neural Net v2.04</p>
          <p>Confidential Document • Internal Use Only</p>
        </div>
      </body>
      </html>
    `;

  const handleExportDoc = () => {
    const reportHtml = getReportHtml();
    const blob = new Blob(['\ufeff', reportHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-summary-${session.id}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportOptions(false);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('PROCTOR AI AUDIT REPORT', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Session Analytics & Integrity Verification', pageWidth / 2, 30, { align: 'center' });

    y = 55;
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(14);
    doc.text('1. CANDIDATE & SESSION OVERVIEW', 20, y);
    y += 10;
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Candidate Name: ${session.candidateName}`, 25, y); y += 7;
    doc.text(`Session ID: ${session.id}`, 25, y); y += 7;
    doc.text(`Generated On: ${new Date().toLocaleString()}`, 25, y);

    y += 15;
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text('2. AI PERFORMANCE METRICS', 20, y);
    y += 10;
    doc.setFillColor(249, 250, 251);
    doc.rect(20, y - 5, pageWidth - 40, 25, 'F');
    doc.setFontSize(10);
    doc.setTextColor(51, 51, 51);
    doc.text(`Integrity Score: ${Math.round(session.cheatingScore)}% Correctness`, 25, y + 2);
    doc.setTextColor(session.cheatingScore > 40 ? 220 : 22, session.cheatingScore > 40 ? 38 : 163, session.cheatingScore > 40 ? 38 : 74);
    doc.text(`Risk Level: ${session.cheatingScore > 40 ? 'CRITICAL RISK / REVIEW REQUIRED' : 'PASS / LOW RISK'}`, 25, y + 9);
    doc.setTextColor(51, 51, 51);
    doc.text(`Active Window: ${session.endTime ? Math.round((session.endTime - session.startTime) / 60000) : '--'} Minutes`, 25, y + 16);

    y += 35;
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text('3. SUSPICIOUS INCIDENT LOG', 20, y);
    y += 10;
    doc.setFontSize(10);
    doc.setTextColor(51, 51, 51);
    doc.text(`Automated tracking recorded ${alerts.length} behavioral flags.`, 25, y);
    
    y += 10;
    doc.setFillColor(248, 250, 252);
    doc.rect(20, y, pageWidth - 40, 10, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('INCIDENT TYPE', 25, y + 7);
    doc.text('COUNT', pageWidth / 2, y + 7);
    doc.text('STATUS', pageWidth - 45, y + 7);
    
    y += 10;
    doc.setTextColor(51, 51, 51);
    Object.entries(alertSummary).forEach(([type, count]) => {
      doc.text(type.replace(/_/g, ' '), 25, y + 7);
      doc.text(count.toString(), pageWidth / 2, y + 7);
      doc.setTextColor(239, 68, 68);
      doc.text('Flagged', pageWidth - 45, y + 7);
      doc.setTextColor(51, 51, 51);
      y += 10;
    });

    if (Object.entries(alertSummary).length === 0) {
      doc.text('No significant alerts recorded', pageWidth / 2, y + 7, { align: 'center' });
      y += 10;
    }

    y += 10;
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text('4. AUDIT CONCLUSION', 20, y);
    y += 10;
    doc.setFillColor(254, 252, 232);
    doc.rect(20, y - 5, pageWidth - 40, 25, 'F');
    doc.setFontSize(9);
    doc.setTextColor(133, 77, 14);
    const conclusion = session.cheatingScore > 40 
      ? 'NOTICE: High risk score detected. Patterns consistent with external assistance or unauthorized reference usage. Manual review is highly recommended.' 
      : 'VERIFIED: Session parameters are within the standard range of integrity. The candidate maintained focus.';
    const splitConclusion = doc.splitTextToSize(conclusion, pageWidth - 50);
    doc.text(splitConclusion, 25, y + 4);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text('Generated by InterviewMate AI Proctoring Engine • Neural Net v2.04', pageWidth / 2, 280, { align: 'center' });
    doc.text('Confidential Document • Internal Use Only', pageWidth / 2, 285, { align: 'center' });

    doc.save(`audit-summary-${session.id}.pdf`);
    setShowExportOptions(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-8"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white w-full max-w-4xl h-full max-h-[90vh] rounded-[2rem] overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-neutral-100 flex items-center justify-between bg-white sticky top-0 z-10 print:hidden">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isHighRisk ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              <BarChart3 size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 font-display">Post-Session Report</h2>
              <p className="text-sm text-neutral-500 font-mono">ID: {session.id}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 hover:bg-neutral-100 rounded-full transition-colors flex items-center justify-center"
          >
            <X size={24} className="text-neutral-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-10 custom-scrollbar">
          
          {/* Summary Grid */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.1, delayChildren: 0.2 }
              }
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }} className="p-6 bg-neutral-50 rounded-3xl border border-neutral-100">
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <User size={14} /> Candidate Info
              </p>
              <h3 className="text-lg font-bold text-neutral-900">{session.candidateName}</h3>
              <p className="text-xs text-neutral-500 mt-1">UID: {session.candidateId.slice(0, 12)}...</p>
            </motion.div>

            <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }} className="p-6 bg-neutral-50 rounded-3xl border border-neutral-100">
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Clock size={14} /> Duration
              </p>
              <h3 className="text-lg font-bold text-neutral-900">
                {session.endTime ? Math.round((session.endTime - session.startTime) / 60000) : '--'} Minutes
              </h3>
              <p className="text-xs text-neutral-500 mt-1">Started: {new Date(session.startTime).toLocaleTimeString()}</p>
            </motion.div>

            {isAdmin && (
              <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }} className={`p-6 rounded-3xl border ${isHighRisk ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                <p className={`text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2 ${isHighRisk ? 'text-red-600' : 'text-green-600'}`}>
                  <ShieldAlert size={14} /> Proctor Score
                </p>
                <h3 className={`text-3xl font-bold ${isHighRisk ? 'text-red-700' : 'text-green-700'}`}>
                  {Math.round(session.cheatingScore)}%
                </h3>
                <p className={`text-[10px] font-bold mt-1 ${isHighRisk ? 'text-red-500' : 'text-green-500'}`}>
                  {isHighRisk ? 'HIGH PROCTORING RISK DETECTED' : 'CLEAN SESSION RECORDED'}
                </p>
                {!isHighRisk && (
                  <motion.div 
                    initial={{ scale: 0, opacity: 0, rotate: -20 }}
                    animate={{ scale: 1, opacity: 1, rotate: -12 }}
                    transition={{ type: "spring", delay: 1 }}
                    className="absolute -top-2 -right-2 px-3 py-1 bg-green-500 text-white text-[10px] font-black uppercase rounded shadow-lg border border-green-400 rotate-[-12deg]"
                  >
                    Integrity Verified
                  </motion.div>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* Alert Analysis */}
          {isAdmin ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  Alert Breakdown
                  <span className="px-2 py-0.5 bg-neutral-100 rounded text-[10px] text-neutral-500 font-mono">{alerts.length} Total</span>
                </h4>
                <div className="space-y-2">
                  {Object.entries(alertSummary).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between p-3 bg-white border border-neutral-100 rounded-xl shadow-sm">
                      <span className="text-xs font-medium text-neutral-700">{type.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-bold bg-neutral-100 px-2 py-1 rounded-lg">{count}</span>
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <div className="py-12 text-center text-neutral-300 border-2 border-dashed border-neutral-100 rounded-3xl">
                      <p className="text-sm">No significant alerts were recorded during this session.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-neutral-900">Incident Timeline</h4>
                <div className="space-y-3">
                  {alerts.slice(0, 10).map((alert, idx) => (
                    <div key={idx} className="flex gap-4 p-4 bg-white border border-neutral-100 rounded-2xl">
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                        <div className="w-px flex-1 bg-neutral-100" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-neutral-800">{alert.message}</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">
                          T + {Math.round((alert.timestamp - session.startTime) / 1000)}s · Confidence: {Math.round(alert.confidence * 100)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center bg-neutral-50 rounded-[2.5rem] border border-neutral-100">
              <ShieldAlert className="mx-auto text-neutral-300 mb-4" size={40} />
              <p className="text-neutral-500 font-medium italic">Detailed proctoring reports are only visible to administrators.</p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 md:p-8 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between">
          <p className="text-xs text-neutral-400">
            This report was auto-generated by InterviewMate neural network.
          </p>
          {isAdmin && (
            <div className="relative">
              {showExportOptions && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="absolute bottom-full right-0 mb-4 bg-white border border-neutral-200 rounded-2xl shadow-2xl p-2 w-48 z-50 pointer-events-auto"
                >
                  <button 
                    onClick={handleExportDoc}
                    className="w-full text-left px-4 py-3 hover:bg-neutral-50 rounded-xl text-sm font-bold text-neutral-700 flex items-center gap-3 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      DOC
                    </div>
                    Word Document
                  </button>
                  <button 
                    onClick={handleExportPdf}
                    className="w-full text-left px-4 py-3 hover:bg-neutral-50 rounded-xl text-sm font-bold text-neutral-700 flex items-center gap-3 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                      PDF
                    </div>
                    PDF Report
                  </button>
                </motion.div>
              )}
              
              <button 
                onClick={() => setShowExportOptions(!showExportOptions)}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95 ${
                  showExportOptions 
                    ? 'bg-neutral-900 text-white' 
                    : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <Download size={16} />
                Export Audit Logs
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
