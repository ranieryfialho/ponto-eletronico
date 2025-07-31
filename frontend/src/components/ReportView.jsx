import { useState, useEffect, useCallback } from "react"
import { auth } from "../firebase-config"
import { toast } from "react-toastify"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { EditPunchModal } from "./EditPunchModal"
import { AtestadoModal } from "./AtestadoModal"

const formatMillisToHours = (millis, allowNegative = false) => {
  if (isNaN(millis)) return "00:00"

  const sign = millis < 0 ? "-" : ""
  if (allowNegative) {
    millis = Math.abs(millis)
  } else if (millis < 0) {
    millis = 0
  }

  const totalSeconds = Math.floor(millis / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

const getExpectedWorkMillis = (dayOfWeek, schedule) => {
  if (!schedule) return 0;

  const dayMap = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
  };

  const dayKey = dayMap[dayOfWeek];
  const daySchedule = schedule[dayKey];

  if (!daySchedule || !daySchedule.isWorkDay || !daySchedule.entry || !daySchedule.exit) {
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && schedule.weekday?.entry && schedule.weekday?.exit) {
      const { entry, exit, breakStart, breakEnd } = schedule.weekday;
      const [entryH, entryM] = entry.split(":").map(Number);
      const [exitH, exitM] = exit.split(":").map(Number);
      const [breakStartH, breakStartM] = (breakStart || "00:00").split(":").map(Number);
      const [breakEndH, breakEndM] = (breakEnd || "00:00").split(":").map(Number);
      const entryDate = new Date(0);
      entryDate.setHours(entryH, entryM);
      const exitDate = new Date(0);
      exitDate.setHours(exitH, exitM);
      const breakStartDate = new Date(0);
      breakStartDate.setHours(breakStartH, breakStartM);
      const breakEndDate = new Date(0);
      breakEndDate.setHours(breakEndH, breakEndM);
      const totalMillis = exitDate - entryDate;
      const breakMillis = breakEndDate - breakStartDate;
      return totalMillis - breakMillis;
    }
    return 0;
  }

  const [entryH, entryM] = daySchedule.entry.split(":").map(Number);
  const [exitH, exitM] = daySchedule.exit.split(":").map(Number);
  const [breakStartH, breakStartM] = (daySchedule.breakStart || "00:00").split(":").map(Number);
  const [breakEndH, breakEndM] = (daySchedule.breakEnd || "00:00").split(":").map(Number);

  const entryDate = new Date(0);
  entryDate.setHours(entryH, entryM);
  const exitDate = new Date(0);
  exitDate.setHours(exitH, exitM);
  const breakStartDate = new Date(0);
  breakStartDate.setHours(breakStartH, breakStartM);
  const breakEndDate = new Date(0);
  breakEndDate.setHours(breakEndH, breakEndM);

  const totalMillis = exitDate - entryDate;
  const breakMillis = breakEndDate - breakStartDate;

  return totalMillis - breakMillis;
};


const getDatesInRange = (startDateStr, endDateStr) => {
  const dates = [];
  const start = new Date(startDateStr.replace(/-/g, '\/'));
  const end = new Date(endDateStr.replace(/-/g, '\/'));
  let currentDate = new Date(start);

  while (currentDate <= end) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
};

export function ReportView({ user, onBack }) {
  const today = new Date().toISOString().split("T")[0]
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)

  const [reportData, setReportData] = useState(null)
  const [employeeProfile, setEmployeeProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingPunch, setEditingPunch] = useState(null)

  const [isAtestadoModalOpen, setIsAtestadoModalOpen] = useState(false);
  const [selectedDateForAtestado, setSelectedDateForAtestado] = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const token = await auth.currentUser.getIdToken()
      const response = await fetch(`/api/admin/employees/${user.uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error("Falha ao buscar perfil.")
      const profileData = await response.json()
      setEmployeeProfile(profileData)
    } catch (err) {
      setError("Não foi possível carregar os dados do perfil. " + err.message)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleGenerateReport = useCallback(async () => {
    if (!user || !startDate || !endDate || !employeeProfile) return
    setIsLoading(true)
    setError("")
    setReportData(null)
    try {
      const token = await auth.currentUser.getIdToken()
      const response = await fetch(
        `/api/admin/reports/time-entries?userId=${user.uid}&startDate=${startDate}&endDate=${endDate}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Falha ao buscar dados.")
      }
      const entries = await response.json()

      const datesInRange = getDatesInRange(startDate, endDate);
      const reportPeriod = {};

      datesInRange.forEach(date => {
        const dateKey = date.toLocaleDateString('pt-BR');
        reportPeriod[dateKey] = {
          punches: [], totalWorkMillis: 0, totalBreakMillis: 0, dailyBalanceMillis: 0,
          isMedicalCertificate: false, justification: null, status: 'NO_RECORD', isComplete: false
        };
      });

      entries.forEach(entry => {
        const date = new Date(entry.timestamp);
        const dateKey = date.toLocaleDateString('pt-BR');
        if (reportPeriod[dateKey]) {
          if (entry.isMedicalCertificate) {
            reportPeriod[dateKey].isMedicalCertificate = true;
            reportPeriod[dateKey].justification = entry.justification;
            reportPeriod[dateKey].status = 'MEDICAL_CERTIFICATE';
          } else {
            reportPeriod[dateKey].punches.push({ ...entry, time: date });
            reportPeriod[dateKey].status = 'HAS_PUNCHES';
          }
        }
      });

      let grandTotalWorkMillis = 0;
      let grandTotalBalanceMillis = 0;

      for (const dateKey in reportPeriod) {
        const dayData = reportPeriod[dateKey];
        if (dayData.status === 'HAS_PUNCHES') {
          let clockInTime = null, breakStartTime = null;
          const dayOfWeek = dayData.punches[0]?.time.getDay();

          dayData.punches.forEach((entry) => {
            if (entry.status === "rejeitado") return;
            const entryTime = entry.time;
            if (entry.type === "Entrada") clockInTime = entryTime;
            if (entry.type === "Início do Intervalo") breakStartTime = entryTime;
            if (entry.type === "Fim do Intervalo" && breakStartTime) {
              dayData.totalBreakMillis += entryTime - breakStartTime;
              breakStartTime = null;
            }
            if (entry.type === "Saída" && clockInTime) {
              dayData.totalWorkMillis += entryTime - clockInTime;
              clockInTime = null;
            }
          });
          
          dayData.isComplete = dayData.punches.some(p => p.type === 'Saída');

          dayData.totalWorkMillis -= dayData.totalBreakMillis;
          const expectedWorkMillis = getExpectedWorkMillis(dayOfWeek, employeeProfile.workHours);
          dayData.dailyBalanceMillis = dayData.totalWorkMillis - expectedWorkMillis;

          grandTotalWorkMillis += dayData.totalWorkMillis;
          
          if (dayData.isComplete || expectedWorkMillis === 0) {
            grandTotalBalanceMillis += dayData.dailyBalanceMillis;
          }
        }
      }

      setReportData({
        groupedEntries: reportPeriod,
        grandTotal: formatMillisToHours(grandTotalWorkMillis),
        grandTotalBalance: formatMillisToHours(grandTotalBalanceMillis, true),
      })

    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [user, startDate, endDate, employeeProfile])

  useEffect(() => {
    if (employeeProfile) {
      handleGenerateReport()
    }
  }, [employeeProfile, handleGenerateReport])

  const handleOpenAtestadoModal = (date) => {
    setSelectedDateForAtestado(date);
    setIsAtestadoModalOpen(true);
  };

  const handleCloseAtestadoModal = () => {
    setIsAtestadoModalOpen(false);
    setSelectedDateForAtestado(null);
  };

  const handleSubmitAtestado = async (reason) => {
    if (!selectedDateForAtestado || !user) return;
    setIsLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/medical-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          userId: user.uid,
          displayName: user.displayName,
          date: selectedDateForAtestado,
          reason
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(data.success);
      handleCloseAtestadoModal();
      await handleGenerateReport();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEditPunchModal = (punch) => {
    setEditingPunch(punch)
    setIsEditModalOpen(true)
  }

  const handleCloseEditPunchModal = () => {
    setIsEditModalOpen(false)
    setEditingPunch(null)
  }

  const handleEditSuccess = () => {
    handleCloseEditPunchModal()
    handleGenerateReport()
  }

  const handleShowOnMap = (location) => {
    if (location && location.lat && location.lon) {
      const url = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lon}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      toast.error("Coordenadas não encontradas para este registro.");
    }
  };

  const handleExportCSV = () => {
    if (!reportData || Object.keys(reportData.groupedEntries).length === 0) {
      alert("Não há dados para exportar.")
      return
    }
    const headers = ["Data", "Tipo de Registro", "Horário", "Unidade", "Latitude", "Longitude", "Saldo do Dia"]
    const csvRows = [headers.join(",")]

    for (const [date, data] of Object.entries(reportData.groupedEntries)) {
      data.punches.forEach((punch) => {
        csvRows.push(
          [
            date,
            `"${punch.type}"`,
            punch.time.toLocaleTimeString("pt-BR"),
            `"${punch.locationName || 'N/A'}"`,
            punch.location?.lat || "",
            punch.location?.lon || "",
            "",
          ].join(","),
        )
      })
      csvRows.push([`"Total Trabalhado (${date})"`, "", "", `"${formatMillisToHours(data.totalWorkMillis)}"`])
      csvRows.push([`"Total em Intervalo (${date})"`, "", "", `"${formatMillisToHours(data.totalBreakMillis)}"`])
      const dailyBalanceText = data.isComplete ? formatMillisToHours(data.dailyBalanceMillis, true) : 'Em andamento';
      csvRows.push([`"Saldo do Dia (${date})"`, "", "", `"${dailyBalanceText}"`])
      csvRows.push([])
    }
    csvRows.push([`"Total de Horas Trabalhadas no Período"`, "", "", `"${reportData.grandTotal}"`])
    csvRows.push([`"Saldo de Horas no Período"`, "", "", `"${reportData.grandTotalBalance}"`])

    const csvString = csvRows.join("\n")
    const blob = new Blob([`\uFEFF${csvString}`], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    const safeName = (user.displayName || user.email).replace(/[\s@.]+/g, "_")
    const fileName = `Relatorio_${safeName}_${startDate}_a_${endDate}.csv`
    link.setAttribute("download", fileName)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

   const handleExportPDF = () => {
    if (!reportData || Object.keys(reportData.groupedEntries).length === 0) {
      alert("Não há dados para exportar.")
      return
    }
    const doc = new jsPDF()
    const formattedStartDate = new Date(startDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })
    const formattedEndDate = new Date(endDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })
    const safeName = (user.displayName || user.email).replace(/[\s@.]+/g, "_")
    const fileName = `Relatorio_${safeName}_${startDate}_a_${endDate}.pdf`

    // Ajustes de posicionamento do cabeçalho (movido para cima)
    doc.setFontSize(18)
    doc.text("Relatório de Ponto", 14, 20) // Y de 22 para 20
    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(`Funcionário: ${user.displayName || user.email}`, 14, 28) // Y de 30 para 28
    doc.text(`Período: ${formattedStartDate} a ${formattedEndDate}`, 14, 34) // Y de 36 para 34

    const tableHeaders = [["Data", "Unidade", "Entrada", "Início Interv.", "Fim Interv.", "Saída", "Total Trab.", "Saldo Dia"]]
    const tableData = []
    
    const sortedDates = Object.entries(reportData.groupedEntries).sort(([dateA], [dateB]) => {
      const [dayA, monthA, yearA] = dateA.split('/');
      const [dayB, monthB, yearB] = dateB.split('/');
      return new Date(`${yearA}-${monthA}-${dayA}`) - new Date(`${yearB}-${monthB}-${dayB}`);
    });

    sortedDates.forEach(([date, data]) => {
      if (data.status === 'MEDICAL_CERTIFICATE') {
        tableData.push([date, { content: `ATESTADO: ${data.justification}`, colSpan: 7, styles: { fontStyle: 'italic', textColor: [100, 100, 100] } }])
      } else if (data.status === 'HAS_PUNCHES') {
        const entryTime = data.punches.find((p) => p.type === "Entrada")?.time.toLocaleTimeString("pt-BR") || "--:--:--"
        const breakStartTime = data.punches.find((p) => p.type === "Início do Intervalo")?.time.toLocaleTimeString("pt-BR") || "--:--:--"
        const breakEndTime = data.punches.find((p) => p.type === "Fim do Intervalo")?.time.toLocaleTimeString("pt-BR") || "--:--:--"
        const exitTime = data.punches.find((p) => p.type === "Saída")?.time.toLocaleTimeString("pt-BR") || "--:--:--"
        const totalWork = formatMillisToHours(data.totalWorkMillis)
        const dailyBalance = data.isComplete ? formatMillisToHours(data.dailyBalanceMillis, true) : '--:--';


        const locations = new Set(data.punches.map(p => p.locationName).filter(Boolean));
        let unitDisplay = "N/D";
        if (locations.size === 1) {
          unitDisplay = Array.from(locations)[0];
        } else if (locations.size > 1) {
          unitDisplay = "Múltiplas";
        }

        tableData.push([date, unitDisplay, entryTime, breakStartTime, breakEndTime, exitTime, totalWork, dailyBalance])
      }
    });

    autoTable(doc, {
      startY: 40, // Inicia a tabela um pouco mais acima (de 45 para 40)
      head: tableHeaders,
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [41, 128, 185] },
      // Adiciona um fator de escala para comprimir a tabela verticalmente se necessário
      cellPadding: 1.5,
      styles: { fontSize: 8 },
    })

    let finalY = doc.lastAutoTable.finalY || 50
    
    // Posiciona o rodapé de totais e assinaturas próximo ao final da página
    const pageHeight = doc.internal.pageSize.getHeight();
    let bottomY = pageHeight - 35; // Posição inicial para o bloco de assinaturas

    // Se a tabela terminar muito perto do rodapé, movemos o rodapé para baixo dela
    if (finalY > bottomY - 20) {
      bottomY = finalY + 15;
    }

    doc.setFontSize(10)
    doc.text("Total de Horas Trabalhadas no Período:", 14, bottomY)
    doc.setFont(undefined, "bold")
    doc.text(reportData.grandTotal, 85, bottomY)

    doc.setFont(undefined, "normal")
    doc.text("Saldo de Horas no Período:", 14, bottomY + 6)
    doc.setFont(undefined, "bold")
    doc.text(reportData.grandTotalBalance, 85, bottomY + 6)

    doc.setFont(undefined, "normal")
    doc.text("_________________________", 14, bottomY + 20)
    doc.text("Assinatura do Colaborador", 20, bottomY + 25)
    doc.text("_________________________", 110, bottomY + 20)
    doc.text("Assinatura do Diretor(a)", 118, bottomY + 25)

    doc.save(fileName)
  }

  const getPunchStatusColor = (punchType, punchTime) => {
    if (!employeeProfile?.workHours) return "text-gray-600"
    const schedule = employeeProfile.workHours;
    const dayOfWeek = punchTime.getDay();

    const dayMap = {
      0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
      4: 'thursday', 5: 'friday', 6: 'saturday',
    };
    const dayKey = dayMap[dayOfWeek];
    let daySchedule = schedule[dayKey];

    // Fallback para o formato antigo
    if (!daySchedule) {
        if (dayOfWeek === 6 && schedule.saturday?.isWorkDay) {
            daySchedule = schedule.saturday;
        } else if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            daySchedule = schedule.weekday;
        } else {
            return "text-gray-600";
        }
    }
    
    if (!daySchedule || !daySchedule.isWorkDay) return "text-gray-600";

    const scheduleMap = {
      Entrada: daySchedule.entry,
      "Início do Intervalo": daySchedule.breakStart,
      "Fim do Intervalo": daySchedule.breakEnd,
      Saída: daySchedule.exit,
    }
    const scheduledTimeString = scheduleMap[punchType]
    if (!scheduledTimeString) return "text-gray-600"
    const [hours, minutes] = scheduledTimeString.split(":")
    const scheduledTime = new Date(punchTime.getTime())
    scheduledTime.setHours(hours, minutes, 0, 0)
    const diffMinutes = (punchTime.getTime() - scheduledTime.getTime()) / 60000
    const tolerance = 10
    if (Math.abs(diffMinutes) <= tolerance) {
      return "text-green-600 font-semibold"
    } else {
      return "text-red-600 font-semibold"
    }
  }


  return (
    <>
      <div className="w-full max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Relatório de Ponto</h1>
            <p className="text-gray-500">{user.displayName || user.email}</p>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 px-3 py-2 rounded-lg shadow-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar
          </button>
        </div>

        <div className="p-6 bg-white rounded-xl shadow-md border border-gray-200">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div>
                <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 text-left">
                  Data de Início
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                />
              </div>
              <div>
                <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 text-left">
                  Data de Fim
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateReport}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md h-11"
              >
                {isLoading ? "Gerando..." : "Gerar Relatório"}
              </button>
              <button
                onClick={handleExportCSV}
                disabled={!reportData || isLoading}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-md h-11 flex items-center justify-center gap-2 disabled:bg-gray-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Excel
              </button>
              <button
                onClick={handleExportPDF}
                disabled={!reportData || isLoading}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md h-11 flex items-center justify-center gap-2 disabled:bg-gray-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                PDF
              </button>
            </div>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>

        {isLoading && (
          <div className="p-6 bg-white rounded-xl shadow-md border text-center text-gray-500">Gerando relatório...</div>
        )}

        {!isLoading && reportData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-center">
                <p className="text-md font-medium text-blue-800">Total de Horas Trabalhadas no Período</p>
                <p className="text-4xl font-bold text-blue-900 mt-1">{reportData.grandTotal}</p>
              </div>
              <div
                className={`p-4 rounded-xl border ${reportData.grandTotalBalance?.startsWith("-") ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"} text-center`}
              >
                <p
                  className={`text-md font-medium ${reportData.grandTotalBalance?.startsWith("-") ? "text-red-800" : "text-green-800"}`}
                >
                  Saldo de Horas no Período
                </p>
                <p
                  className={`text-4xl font-bold ${reportData.grandTotalBalance?.startsWith("-") ? "text-red-900" : "text-green-900"} mt-1`}
                >
                  {reportData.grandTotalBalance}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {Object.keys(reportData.groupedEntries).length > 0 ? (
                Object.entries(reportData.groupedEntries).map(([date, data]) => {
                  const [day, month, year] = date.split('/');
                  const dateObj = new Date(year, parseInt(month, 10) - 1, parseInt(day, 10));
                  const dayOfWeek = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
                  const formattedDayOfWeek = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);

                  if (data.status === 'NO_RECORD') {
                    return (
                      <div key={date} className="p-4 bg-white rounded-xl shadow border border-gray-200">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold text-gray-700">Dia: {date} ({formattedDayOfWeek})</h3>
                          <button
                            onClick={() => handleOpenAtestadoModal(date)}
                            className="bg-blue-100 text-blue-800 text-xs font-bold py-1 px-3 rounded-full hover:bg-blue-200"
                          >
                            Lançar Atestado
                          </button>
                        </div>
                        <p className="text-center text-gray-400 mt-2 text-sm">Nenhum registro de ponto.</p>
                      </div>
                    );
                  }

                  if (data.status === 'MEDICAL_CERTIFICATE') {
                    return (
                      <div key={date} className="p-4 bg-blue-50 rounded-xl shadow border border-blue-200">
                        <h3 className="text-lg font-semibold text-blue-800">Dia: {date} ({formattedDayOfWeek})</h3>
                        <div className="mt-2 pl-2">
                          <p className="font-semibold">Atestado Médico</p>
                          <p className="text-sm text-gray-600 italic">Motivo: {data.justification}</p>
                        </div>
                      </div>
                    );
                  }

                  const dailyBalanceIsNegative = data.dailyBalanceMillis < 0
                  return (
                    <div key={date} className="p-6 bg-white rounded-xl shadow-md border border-gray-200">
                      <h3 className="text-lg font-semibold mb-4">Dia: {date} ({formattedDayOfWeek})</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <div className="bg-green-100 p-4 rounded-lg text-center">
                          <p className="text-sm font-medium text-green-800">Total Trabalhado</p>
                          <p className="text-2xl font-bold text-green-900">
                            {formatMillisToHours(data.totalWorkMillis)}
                          </p>
                        </div>
                        <div className="bg-yellow-100 p-4 rounded-lg text-center">
                          <p className="text-sm font-medium text-yellow-800">Total em Intervalo</p>
                          <p className="text-2xl font-bold text-yellow-900">
                            {formatMillisToHours(data.totalBreakMillis)}
                          </p>
                        </div>
                        <div
                          className={`p-4 rounded-lg text-center ${!data.isComplete ? 'bg-gray-100' : dailyBalanceIsNegative ? "bg-red-100" : "bg-blue-100"}`}
                        >
                          <p className={`text-sm font-medium ${!data.isComplete ? "text-gray-800" : dailyBalanceIsNegative ? "text-red-800" : "text-blue-800"}`}>
                            Saldo do Dia
                          </p>
                          <p className={`text-2xl font-bold ${!data.isComplete ? "text-gray-700" : dailyBalanceIsNegative ? "text-red-700" : "text-blue-700"}`}>
                            {data.isComplete ? formatMillisToHours(data.dailyBalanceMillis, true) : 'Em andamento'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 border-t pt-2">
                        <div className="grid grid-cols-5 gap-4 px-3 py-2 text-xs font-bold text-gray-500 uppercase">
                          <div className="col-span-2">Tipo</div>
                          <div className="col-span-1">Unidade</div>
                          <div className="col-span-2 text-right">Horário</div>
                        </div>
                        <ul className="divide-y divide-gray-200">
                          {data.punches.map((entry) => {
                            const timeColorClass = getPunchStatusColor(entry.type, entry.time)
                            const isRejected = entry.status === "rejeitado"
                            return (
                              <li key={entry.id} className={`py-3 px-3 ${isRejected ? "bg-red-50" : ""}`}>
                                <div className="grid grid-cols-5 gap-4 items-center">
                                  <div className={`col-span-2 font-medium ${isRejected ? "line-through text-red-600" : "text-gray-800"}`}>
                                    {entry.type}
                                  </div>
                                  <div className={`col-span-1 text-sm ${isRejected ? "line-through text-red-500" : "text-gray-600"}`}>
                                    {entry.locationName || 'N/D'}
                                  </div>
                                  <div className="col-span-2 flex items-center justify-end gap-2 sm:gap-4">
                                    <button onClick={() => handleOpenEditPunchModal(entry)} title="Editar Registro" className="p-1 text-gray-400 hover:text-indigo-600 rounded-full">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                    <button onClick={() => handleShowOnMap(entry.location)} title="Ver localização no mapa" className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-full">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    </button>
                                    <span className={`font-mono text-lg ${isRejected ? "text-red-600 line-through" : timeColorClass}`}>
                                      {entry.time.toLocaleTimeString("pt-BR")}
                                    </span>
                                  </div>
                                </div>

                                {entry.isEdited && (
                                  <p className="text-xs text-indigo-700 mt-1 pl-1">
                                    Editado pelo gestor. Motivo: {entry.editReason}
                                  </p>
                                )}
                                {isRejected && entry.rejectionReason && (
                                  <p className="text-xs text-red-700 mt-1 pl-1">
                                    Motivo da Rejeição: {entry.rejectionReason}
                                  </p>
                                )}
                                {entry.justification && (
                                  <p className="text-xs text-blue-700 mt-1 pl-1 italic">
                                    Justificativa do Funcionário: "{entry.justification}"
                                  </p>
                                )}

                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="p-6 bg-white rounded-xl shadow-md border text-center text-gray-500">
                  Nenhuma marcação encontrada para o período selecionado.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <EditPunchModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditPunchModal}
        entry={editingPunch}
        onSuccess={handleEditSuccess}
      />
      <AtestadoModal
        isOpen={isAtestadoModalOpen}
        onClose={handleCloseAtestadoModal}
        onSubmit={handleSubmitAtestado}
        selectedDate={selectedDateForAtestado}
      />
    </>
  )
}