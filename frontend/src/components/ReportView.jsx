// src/components/ReportView.jsx (Completo e com fetch relativo)
import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../firebase-config';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatMillisToHours = (millis) => {
  if (isNaN(millis) || millis < 0) return '00:00';
  const totalSeconds = Math.floor(millis / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export function ReportView({ user, onBack }) {
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  
  const [reportData, setReportData] = useState(null);
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const token = await auth.currentUser.getIdToken();
        // MUDANÇA AQUI
        const response = await fetch(`/api/admin/employees/${user.uid}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Falha ao buscar perfil.');
        const profileData = await response.json();
        setEmployeeProfile(profileData);
      } catch (err) {
        setError('Não foi possível carregar os dados do perfil. ' + err.message);
        setIsLoading(false); 
      }
    };
    fetchProfile();
  }, [user]);

  const handleGenerateReport = useCallback(async () => {
    if (!user || !startDate || !endDate || !employeeProfile) return;
    setIsLoading(true);
    setError('');
    setReportData(null);
    try {
      const token = await auth.currentUser.getIdToken();
      // MUDANÇA AQUI
      const response = await fetch(`/api/admin/reports/time-entries?userId=${user.uid}&startDate=${startDate}&endDate=${endDate}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Falha ao buscar dados.'); }
      const entries = await response.json();
      const entriesByDay = entries.reduce((acc, entry) => {
        const date = new Date(entry.timestamp).toLocaleDateString('pt-BR');
        if (!acc[date]) { acc[date] = { punches: [], totalWorkMillis: 0, totalBreakMillis: 0 }; }
        acc[date].punches.push({ ...entry, time: new Date(entry.timestamp) });
        return acc;
      }, {});
      for (const date in entriesByDay) {
        let clockInTime = null, breakStartTime = null;
        entriesByDay[date].punches.forEach(entry => {
          const entryTime = entry.time;
          if (entry.type === 'Entrada') clockInTime = entryTime;
          if (entry.type === 'Início do Intervalo') breakStartTime = entryTime;
          if (entry.type === 'Fim do Intervalo' && breakStartTime) { entriesByDay[date].totalBreakMillis += entryTime - breakStartTime; breakStartTime = null; }
          if (entry.type === 'Saída' && clockInTime) { entriesByDay[date].totalWorkMillis += entryTime - clockInTime; clockInTime = null; }
        });
        entriesByDay[date].totalWorkMillis -= entriesByDay[date].totalBreakMillis;
      }
      setReportData({ groupedEntries: entriesByDay });
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  }, [user, startDate, endDate, employeeProfile]);

  useEffect(() => {
    if (employeeProfile) {
      handleGenerateReport();
    }
  }, [employeeProfile, handleGenerateReport]);

  const handleExportCSV = () => {
    if (!reportData || Object.keys(reportData.groupedEntries).length === 0) { alert('Não há dados para exportar.'); return; }
    const headers = ['Data', 'Tipo de Registro', 'Horário'];
    const csvRows = [headers.join(',')];
    for (const [date, data] of Object.entries(reportData.groupedEntries)) {
      data.punches.forEach(punch => { csvRows.push([date, `"${punch.type}"`, punch.time.toLocaleTimeString('pt-BR')].join(',')); });
      csvRows.push([`"Total Trabalhado (${date})"`, `"${formatMillisToHours(data.totalWorkMillis)}"`]);
      csvRows.push([`"Total em Intervalo (${date})"`, `"${formatMillisToHours(data.totalBreakMillis)}"`]);
      csvRows.push([]);
    }
    const csvString = csvRows.join('\n');
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const safeName = (user.displayName || user.email).replace(/[\s@.]+/g, '_');
    const fileName = `Relatorio_${safeName}_${startDate}_a_${endDate}.csv`;
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleExportPDF = () => {
    if (!reportData || Object.keys(reportData.groupedEntries).length === 0) { alert('Não há dados para exportar.'); return; }
    const doc = new jsPDF();
    const formattedStartDate = new Date(startDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
    const formattedEndDate = new Date(endDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
    const safeName = (user.displayName || user.email).replace(/[\s@.]+/g, '_');
    const fileName = `Relatorio_${safeName}_${startDate}_a_${endDate}.pdf`;

    doc.setFontSize(18); doc.text('Relatório de Ponto', 14, 22);
    doc.setFontSize(11); doc.setTextColor(100);
    doc.text(`Funcionário: ${user.displayName || user.email}`, 14, 30);
    doc.text(`Período: ${formattedStartDate} a ${formattedEndDate}`, 14, 36);

    const tableData = []; const tableHeaders = [['Data', 'Tipo de Registro', 'Horário']];
    
    for (const [date, data] of Object.entries(reportData.groupedEntries)) {
      tableData.push([{ content: `Marcações do dia ${date}`, colSpan: 3, styles: { fontStyle: 'bold', fillColor: '#f3f4f6' } }]);
      data.punches.forEach(punch => { tableData.push([date, punch.type, punch.time.toLocaleTimeString('pt-BR')]); });
      tableData.push([{ content: `Total Trabalhado: ${formatMillisToHours(data.totalWorkMillis)}`, colSpan: 3, styles: { fontStyle: 'italic', halign: 'right' } }]);
      tableData.push([{ content: `Total em Intervalo: ${formatMillisToHours(data.totalBreakMillis)}`, colSpan: 3, styles: { fontStyle: 'italic', halign: 'right' } }]);
    }
    
    autoTable(doc, { startY: 45, head: tableHeaders, body: tableData, theme: 'grid' });
    doc.save(fileName);
  };
  
  const getPunchStatusColor = (punchType, punchTime) => {
    const schedule = employeeProfile?.workHours;
    if (!schedule) return 'text-gray-600';
    const scheduleMap = { 'Entrada': schedule.entry, 'Início do Intervalo': schedule.breakStart, 'Fim do Intervalo': schedule.breakEnd, 'Saída': schedule.exit, };
    const scheduledTimeString = scheduleMap[punchType];
    if (!scheduledTimeString) return 'text-gray-600';
    const [hours, minutes] = scheduledTimeString.split(':');
    const scheduledTime = new Date(punchTime.getTime());
    scheduledTime.setHours(hours, minutes, 0, 0);
    const diffMinutes = (punchTime.getTime() - scheduledTime.getTime()) / 60000;
    const tolerance = 10;
    if (Math.abs(diffMinutes) <= tolerance) { return 'text-green-600 font-semibold'; } 
    else { return 'text-red-600 font-semibold'; }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
       <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Relatório de Ponto</h1>
          <p className="text-gray-500">{user.displayName || user.email}</p>
        </div>
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 px-3 py-2 rounded-lg shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Voltar
        </button>
      </div>

      <div className="p-6 bg-white rounded-xl shadow-md border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-1"><label htmlFor="start-date" className="block text-sm font-medium text-gray-700">Data de Início</label><input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div>
          <div className="md:col-span-1"><label htmlFor="end-date" className="block text-sm font-medium text-gray-700">Data de Fim</label><input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div>
          <button onClick={handleGenerateReport} disabled={isLoading} className="md:col-span-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md h-11">{isLoading ? 'Gerando...' : 'Gerar Relatório'}</button>
          <button onClick={handleExportCSV} disabled={!reportData || isLoading} className="md:col-span-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-md h-11 flex items-center justify-center gap-2 disabled:bg-gray-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Excel</button>
          <button onClick={handleExportPDF} disabled={!reportData || isLoading} className="md:col-span-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md h-11 flex items-center justify-center gap-2 disabled:bg-gray-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>PDF</button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {isLoading && <div className="p-6 bg-white rounded-xl shadow-md border text-center text-gray-500">Gerando relatório...</div>}
      
      {!isLoading && reportData && (
        <div className="space-y-4">
          {Object.keys(reportData.groupedEntries).length > 0 ? (
            Object.entries(reportData.groupedEntries).map(([date, data]) => (
              <div key={date} className="p-6 bg-white rounded-xl shadow-md border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Dia: {date}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="bg-green-100 p-4 rounded-lg text-center"><p className="text-sm font-medium text-green-800">Total Trabalhado</p><p className="text-3xl font-bold text-green-900">{formatMillisToHours(data.totalWorkMillis)}</p></div>
                  <div className="bg-yellow-100 p-4 rounded-lg text-center"><p className="text-sm font-medium text-yellow-800">Total em Intervalo</p><p className="text-3xl font-bold text-yellow-900">{formatMillisToHours(data.totalBreakMillis)}</p></div>
                </div>
                <ul className="divide-y divide-gray-200">
                  {data.punches.map(entry => {
                    const timeColorClass = getPunchStatusColor(entry.type, entry.time);
                    return (
                      <li key={entry.id} className="py-2 flex justify-between items-center">
                        <span className="font-medium text-gray-800">{entry.type}</span>
                        <span className={`font-mono text-lg ${timeColorClass}`}>
                          {entry.time.toLocaleTimeString('pt-BR')}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          ) : (
            <div className="p-6 bg-white rounded-xl shadow-md border border-gray-200 text-center text-gray-500">Nenhuma marcação encontrada para o período selecionado.</div>
          )}
        </div>
      )}
    </div>
  );
}