import React from 'react';

const daysOfWeek = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

export function MySchedule({ workHours, onBack }) {
  const safeWorkHours = workHours || {};

  return (
    <div className="w-full max-w-md">
        <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-200">
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
                <h2 className="text-xl font-bold text-gray-800">Minha Jornada de Trabalho</h2>
                <button
                onClick={onBack}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 px-3 py-2 rounded-lg shadow-sm"
                >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Voltar
                </button>
            </div>

            {Object.keys(safeWorkHours).length > 0 ? (
                <div className="space-y-4">
                {daysOfWeek.map(day => {
                    const daySchedule = safeWorkHours[day.key];
                    const isWorkDay = daySchedule && daySchedule.isWorkDay;

                    return (
                    <div key={day.key} className={`p-4 border rounded-lg ${isWorkDay ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                        <h3 className={`font-semibold ${isWorkDay ? 'text-green-800' : 'text-gray-500'}`}>{day.label}</h3>
                        {isWorkDay ? (
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                            <div>
                                <p className="text-xs text-gray-500">Entrada</p>
                                <p className="font-mono text-base font-medium text-gray-900">{daySchedule.entry || '--:--'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Início Pausa</p>
                                <p className="font-mono text-base font-medium text-gray-900">{daySchedule.breakStart || '--:--'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Fim Pausa</p>
                                <p className="font-mono text-base font-medium text-gray-900">{daySchedule.breakEnd || '--:--'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Saída</p>
                                <p className="font-mono text-base font-medium text-gray-900">{daySchedule.exit || '--:--'}</p>
                            </div>
                        </div>
                        ) : (
                            <p className="text-sm text-gray-400 mt-1">Não é um dia de trabalho.</p>
                        )}
                    </div>
                    );
                })}
                </div>
            ) : (
                <p className="text-center text-gray-600 mt-8">
                Sua jornada de trabalho ainda não foi cadastrada.
                </p>
            )}
        </div>
    </div>
  );
}