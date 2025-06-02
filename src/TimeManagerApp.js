import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
// Firebase imports removed
import { Clock, Play, Pause, PlusCircle, CalendarDays, Trash2, Edit3, ListChecks, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Save, Filter, FileText, BarChart3 } from 'lucide-react';
import postgresTicketService from './postgresTicketService'; // Import the new service

// --- Configuração do Firebase (REMOVIDA) ---
// const firebaseConfig = ... (removido)
// const appId = ... (removido)
// const app = ... (removido)
// const auth = ... (removido)
// const db = ... (removido)
const appId = 'local-dev-app'; // Placeholder if still used in UI, otherwise remove

// --- Definição da Entidade (Conceitual) ---
// Mantém-se a mesma, mas Timestamp será JS Date
// interface TicketEntity {
//   id?: string;
//   ticketIdInput: string;
//   subject: string;
//   accountName: string;
//   priority: string;
//   difficulty: string;
//   creationTime: Date; // Alterado de Timestamp para Date
//   status: 'Pendente' | 'Em Progresso' | 'Pausado' | 'Concluído';
//   elapsedTime: number;
//   isActive: boolean;
//   log: Array<{ timestamp: Date; action: string; reason?: string; checklist?: object }>; // Alterado de Timestamp para Date
//   checklist: { respondeuTicket: boolean; respondeuPlanilha: boolean };
//   userId: string;
//   currentTimerStartTime?: Date | null; // Alterado de Timestamp para Date
//   lastUpdatedAt?: Date; // Alterado de Timestamp para Date
//   createdAt?: Date; // Alterado de Timestamp para Date
// }

// --- Camada de Serviço de Persistência (Firebase Ticket Repository Adapter - REMOVIDO) ---
// const firebaseTicketService = { ... }; // Removido

// --- Contexto do Repositório de Tickets ---
const TicketRepositoryContext = createContext(postgresTicketService); // Fornece o serviço PostgreSQL por padrão

// Hook para usar o repositório de tickets
const useTicketRepository = () => useContext(TicketRepositoryContext);


// --- Funções Auxiliares (mesmas de antes) ---
const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};
const formatDate = (dateInput) => {
    if (!dateInput) return 'N/A';
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return 'Data inválida';
    // For display, usually better to let browser handle local timezone rendering
    return date.toLocaleDateString('pt-BR');
};
const formatDateTime = (dateInput) => {
    if (!dateInput) return 'N/A';
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return 'Data/Hora inválida';
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

// --- Componentes (a maioria permanece igual na sua estrutura, mas usará o serviço) ---

const Modal = ({ isOpen, onClose, title, children, size = 'max-w-md' }) => { /* ... sem alterações ... */ 
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className={`bg-white p-6 rounded-lg shadow-xl w-full ${size} transform transition-all text-gray-900`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <XCircle size={24} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
};

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => { /* ... sem alterações ... */ 
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <p className="text-gray-700 mb-6">{message}</p>
            <div className="flex justify-end space-x-3">
                <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">Cancelar</button>
                <button onClick={onConfirm} className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">Confirmar</button>
            </div>
        </Modal>
    );
};

const TicketForm = ({ userId, onTicketAdded, ticketToEdit, onTicketUpdated, onCancelEdit }) => {
    const ticketRepository = useTicketRepository(); // Usa o serviço através do contexto
    const [ticketIdInput, setTicketIdInput] = useState('');
    const [subject, setSubject] = useState('');
    const [accountName, setAccountName] = useState('');
    const [priority, setPriority] = useState('Médio Impacto');
    const [difficulty, setDifficulty] = useState('Médio');
    const [creationDate, setCreationDate] = useState(new Date().toISOString().split('T')[0]);
    const [formMessage, setFormMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        if (ticketToEdit) {
            setTicketIdInput(ticketToEdit.ticketIdInput || '');
            setSubject(ticketToEdit.subject || '');
            setAccountName(ticketToEdit.accountName || '');
            setPriority(ticketToEdit.priority || 'Médio Impacto');
            setDifficulty(ticketToEdit.difficulty || 'Médio');
            // Ensure creationTime is handled as JS Date
            const initialCreationDate = ticketToEdit.creationTime ? (ticketToEdit.creationTime instanceof Date ? ticketToEdit.creationTime : new Date(ticketToEdit.creationTime)) : new Date();
            setCreationDate(initialCreationDate.toISOString().split('T')[0]);
        } else {
            setTicketIdInput(''); setSubject(''); setAccountName('');
            setPriority('Médio Impacto'); setDifficulty('Médio');
            setCreationDate(new Date().toISOString().split('T')[0]);
        }
        setFormMessage({ text: '', type: '' });
    }, [ticketToEdit]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormMessage({ text: '', type: '' }); 
        if (!subject.trim() || !userId) {
            setFormMessage({ text: "Assunto do ticket é obrigatório.", type: "error" });
            return;
        }

        // Monta o objeto do ticket (TicketEntity)
        const ticketDataObject = {
            ticketIdInput: ticketIdInput.trim() || `T-${Date.now().toString().slice(-6)}`,
            subject: subject.trim(),
            accountName: accountName.trim(),
            priority,
            difficulty,
            creation_time: new Date(creationDate + "T00:00:00Z"), // Use ISO string, field name matches DB
            status: ticketToEdit ? ticketToEdit.status : 'Pendente',
            elapsed_time: ticketToEdit ? ticketToEdit.elapsed_time : 0, // field name matches DB
            is_active: ticketToEdit ? ticketToEdit.is_active : false, // field name matches DB
            log: ticketToEdit ? ticketToEdit.log : [],
            checklist: ticketToEdit ? ticketToEdit.checklist : { respondeuTicket: false, respondeuPlanilha: false },
            user_id: userId, // field name matches DB
            // created_at e last_updated_at são definidos pelo serviço/DB
        };
        // Se estiver editando, preserva o ID e created_at original (service might ignore created_at on update)
        if (ticketToEdit) {
            // ticketDataObject.id = ticketToEdit.id; // ID passed separately to updateTicket
            ticketDataObject.created_at = ticketToEdit.created_at;
        }


        try {
            if (ticketToEdit) {
                await ticketRepository.updateTicket(userId, ticketToEdit.id, ticketDataObject);
                if (onTicketUpdated) onTicketUpdated();
                setFormMessage({ text: "Ticket atualizado com sucesso!", type: "success" });
            } else {
                await ticketRepository.addTicket(userId, ticketDataObject);
                if (onTicketAdded) onTicketAdded();
                setFormMessage({ text: "Ticket adicionado com sucesso!", type: "success" });
            }
            if (!ticketToEdit || (ticketToEdit && onTicketAdded)) {
                 setTicketIdInput(''); setSubject(''); setAccountName('');
                 setPriority('Médio Impacto'); setDifficulty('Médio');
                 setCreationDate(new Date().toISOString().split('T')[0]);
            }
        } catch (error) {
            console.error("Erro ao salvar ticket:", error);
            setFormMessage({ text: `Erro ao salvar ticket: ${error.message}`, type: "error" });
        }
    };
    
    // O JSX do formulário permanece visualmente o mesmo
    return (
        <form onSubmit={handleSubmit} className="p-4 bg-slate-800 rounded-lg shadow mb-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-100 mb-3">{ticketToEdit ? 'Editar Ticket' : 'Adicionar Novo Ticket'}</h3>
            {formMessage.text && (
                <p className={`text-sm mb-3 p-2 rounded ${formMessage.type === 'error' ? 'bg-red-500/30 text-red-300' : 'bg-green-500/30 text-green-300'}`}>
                    {formMessage.text}
                </p>
            )}
            {/* Campos do formulário (inputs, selects) - sem alterações visuais */}
            <div>
                <label htmlFor="ticketIdInput" className="block text-sm font-medium text-gray-300">ID do Ticket (Opcional)</label>
                <input type="text" id="ticketIdInput" value={ticketIdInput} onChange={(e) => setTicketIdInput(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900" />
            </div>
            <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-300">Assunto *</label>
                <input type="text" id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required
                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900" />
            </div>
            <div>
                <label htmlFor="accountName" className="block text-sm font-medium text-gray-300">Nome da Conta</label>
                <input type="text" id="accountName" value={accountName} onChange={(e) => setAccountName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="priority" className="block text-sm font-medium text-gray-300">Prioridade</label>
                    <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900">
                        <option value="Solicitado por Terceiros">Solicitado por Terceiros</option>
                        <option value="Alto Impacto">Alto Impacto</option>
                        <option value="Médio Impacto">Médio Impacto</option>
                        <option value="Baixo Impacto">Baixo Impacto</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="difficulty" className="block text-sm font-medium text-gray-300">Dificuldade</label>
                    <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900">
                        <option value="Fácil">Fácil</option>
                        <option value="Médio">Médio</option>
                        <option value="Difícil">Difícil</option>
                    </select>
                </div>
            </div>
            <div>
                <label htmlFor="creationDate" className="block text-sm font-medium text-gray-300">Data de Criação</label>
                <input type="date" id="creationDate" value={creationDate} onChange={(e) => setCreationDate(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900" />
            </div>
            <div className="flex justify-end space-x-2">
                 {ticketToEdit && (
                    <button type="button" onClick={onCancelEdit}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-300 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        Cancelar Edição
                    </button>
                )}
                <button type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center space-x-2">
                    <Save size={18} />
                    <span>{ticketToEdit ? 'Salvar Alterações' : 'Adicionar Ticket'}</span>
                </button>
            </div>
        </form>
    );
};

const StopTimerModal = ({ isOpen, onClose, onStopConfirm, ticket }) => { /* ... sem alterações na lógica interna, apenas no JSX se necessário ... */ 
    const [reason, setReason] = useState('');
    const [respondeuTicket, setRespondeuTicket] = useState(false);
    const [respondeuPlanilha, setRespondeuPlanilha] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false); 
    const [modalMessage, setModalMessage] = useState('');

    useEffect(() => {
        if (isOpen && ticket) { 
            setRespondeuTicket(ticket.checklist?.respondeuTicket || false);
            setRespondeuPlanilha(ticket.checklist?.respondeuPlanilha || false);
            setReason(''); 
            setModalMessage('');
            setIsCompleting(false); 
        }
    }, [isOpen, ticket]);

    const handleConfirmWrapper = (completeTask) => {
        setModalMessage(''); 
        if (!completeTask && !reason.trim()) { 
            setModalMessage("O motivo da pausa é obrigatório.");
            return;
        }
        if (completeTask && (!respondeuTicket || !respondeuPlanilha)) {
            setModalMessage("Por favor, confirme que respondeu ao ticket e à planilha antes de completar.");
            return;
        }
        onStopConfirm(reason, { respondeuTicket, respondeuPlanilha }, completeTask);
        onClose();
    };

    if (!ticket) return null;
    // JSX do modal permanece visualmente o mesmo
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isCompleting ? `Completar Ticket: ${ticket.subject}` : `Pausar Ticket: ${ticket.subject}`}>
            <div className="space-y-4">
                {modalMessage && <p className="text-red-500 text-sm mb-2 p-2 bg-red-100 rounded">{modalMessage}</p>}
                
                {!isCompleting && ( 
                    <div>
                        <label htmlFor="reason" className="block text-sm font-medium text-gray-700">Motivo da Pausa *</label>
                        <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows="3" required
                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900"
                            placeholder="Ex: Reunião, Almoço, Mudei para outra tarefa..." />
                    </div>
                )}
               
                {isCompleting && ( 
                    <div className="space-y-2 pt-2">
                        <p className="text-sm font-medium text-gray-700">Checklist de Finalização *</p>
                        <label className="flex items-center space-x-2 text-sm text-gray-600">
                            <input type="checkbox" checked={respondeuTicket} onChange={(e) => setRespondeuTicket(e.target.checked)} 
                                   className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
                            <span>Respondeu o ticket na plataforma principal?</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm text-gray-600">
                            <input type="checkbox" checked={respondeuPlanilha} onChange={(e) => setRespondeuPlanilha(e.target.checked)}
                                   className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
                            <span>Atualizou a planilha de controle?</span>
                        </label>
                    </div>
                )}
                
                <div className="flex justify-end space-x-3 pt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">Cancelar</button>
                    <button onClick={() => { setIsCompleting(false); handleConfirmWrapper(false); }} className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600">Pausar Tarefa</button>
                    <button onClick={() => { setIsCompleting(true); handleConfirmWrapper(true); }} className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600">Completar Tarefa</button>
                </div>
            </div>
        </Modal>
    );
};

const TicketItem = ({ ticket, onToggleTimer, onDeleteTicket, onEditTicket, activeTicketId }) => { /* ... sem alterações na lógica interna, apenas no JSX se necessário ... */ 
    const [currentElapsedTime, setCurrentElapsedTime] = useState(ticket.elapsedTime);
    const [timerIntervalId, setTimerIntervalId] = useState(null);
    const [isStopModalOpen, setIsStopModalOpen] = useState(false);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const isActive = ticket.id === activeTicketId;

    useEffect(() => {
        setCurrentElapsedTime(ticket.elapsed_time); // field name matches DB
        if (isActive && ticket.status === 'Em Progresso' && ticket.current_timer_start_time) {
            const initialNow = new Date();
            // current_timer_start_time can be null or a string/Date from DB
            const startTimeMs = ticket.current_timer_start_time instanceof Date 
                ? ticket.current_timer_start_time.getTime() 
                : (ticket.current_timer_start_time ? new Date(ticket.current_timer_start_time).getTime() : initialNow.getTime());
            
            const initialSessionSeconds = Math.floor((initialNow.getTime() - startTimeMs) / 1000);
            setCurrentElapsedTime(ticket.elapsed_time + initialSessionSeconds);

            const intervalId = setInterval(() => {
                const now = new Date();
                const currentStartTimeMs = ticket.current_timer_start_time instanceof Date 
                    ? ticket.current_timer_start_time.getTime() 
                    : (ticket.current_timer_start_time ? new Date(ticket.current_timer_start_time).getTime() : now.getTime());
                const sessionSeconds = Math.floor((now.getTime() - currentStartTimeMs) / 1000);
                setCurrentElapsedTime(ticket.elapsed_time + sessionSeconds);
            }, 1000);
            setTimerIntervalId(intervalId);
            return () => clearInterval(intervalId);
        } else if (timerIntervalId) {
            clearInterval(timerIntervalId);
            setTimerIntervalId(null);
        }
    }, [isActive, ticket.status, ticket.current_timer_start_time, ticket.elapsed_time, timerIntervalId]); // Added timerIntervalId to dependencies


    const handleToggle = () => {
        if (isActive && ticket.status === 'Em Progresso') { 
            setIsStopModalOpen(true);
        } else { 
            if (ticket.status !== 'Concluído') {
                 onToggleTimer(ticket.id, ticket.status);
            }
        }
    };

    const handleStopConfirm = async (reason, checklist, isCompleting) => {
        await onToggleTimer(ticket.id, ticket.status, reason, checklist, isCompleting);
        setIsStopModalOpen(false);
    };
    
    const handleDelete = () => {
        onDeleteTicket(ticket.id);
        setIsConfirmDeleteOpen(false);
    };

    const getPriorityClass = (priority) => {
        if (priority === 'Solicitado por Terceiros') return 'text-purple-400 font-bold';
        if (priority === 'Alto Impacto') return 'text-red-400';
        if (priority === 'Médio Impacto') return 'text-yellow-400';
        return 'text-blue-400'; 
    };

    const getStatusStyles = () => {
        switch (ticket.status) {
            case 'Em Progresso': return { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500', itemText: 'text-gray-100' };
            case 'Pausado': return { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500', itemText: 'text-gray-100' };
            case 'Concluído': return { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500', itemText: 'text-gray-300' };
            case 'Pendente': return { bg: 'bg-slate-700', text: 'text-gray-400', border: 'border-slate-600', itemText: 'text-gray-200' };
            default: return { bg: 'bg-slate-700', text: 'text-gray-400', border: 'border-slate-600', itemText: 'text-gray-200'};
        }
    };
    const styles = getStatusStyles();
    // JSX do item do ticket permanece visualmente o mesmo
    return (
        <div className={`p-4 rounded-lg shadow-md border-l-4 ${styles.bg} ${styles.border} mb-4 transition-all duration-300`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className={`flex-grow mb-3 sm:mb-0 ${styles.itemText}`}>
                    <div className="flex items-center justify-between">
                         <h4 className={`text-lg font-semibold ${styles.itemText}`}>{ticket.subject}</h4>
                         <button onClick={() => setExpanded(!expanded)} className={`p-1 ${styles.text} hover:text-indigo-400`}>
                            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                    </div>
                    <p className="text-sm ">ID: {ticket.ticket_id_input} | Conta: {ticket.account_name || 'N/A'}</p>
                    <p className="text-sm ">Prioridade: <span className={getPriorityClass(ticket.priority)}>{ticket.priority}</span> | Dificuldade: {ticket.difficulty}</p>
                    <p className="text-sm ">Criado em: {formatDate(ticket.creation_time)}</p>
                    <p className={`text-sm font-medium ${styles.text}`}>Status: {ticket.status}</p>
                </div>
                <div className="flex flex-col items-end space-y-2 w-full sm:w-auto">
                    <div className="text-2xl font-mono text-indigo-400 tracking-wider">
                        <Clock size={22} className="inline mr-2" />{formatTime(currentElapsedTime || 0)}
                    </div>
                    <div className="flex space-x-2">
                        {ticket.status !== 'Concluído' && (
                            <button onClick={handleToggle}
                                className={`p-2 rounded-md text-white transition-colors duration-150 flex items-center space-x-1 text-sm
                                    ${isActive && ticket.status === 'Em Progresso' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>
                                {isActive && ticket.status === 'Em Progresso' ? <Pause size={16} /> : <Play size={16} />}
                                <span>{isActive && ticket.status === 'Em Progresso' ? 'Pausar/Parar' : (ticket.status === 'Pausado' ? 'Retomar' : 'Iniciar')}</span>
                            </button>
                        )}
                         <button onClick={() => onEditTicket(ticket)} title="Editar Ticket"
                            className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-150">
                            <Edit3 size={16} />
                        </button>
                        <button onClick={() => setIsConfirmDeleteOpen(true)} title="Excluir Ticket"
                            className="p-2 bg-slate-600 text-white rounded-md hover:bg-slate-500 transition-colors duration-150">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {expanded && (
                <div className={`mt-4 pt-3 border-t ${styles.border} border-opacity-50 ${styles.itemText}`}>
                    <h5 className="text-sm font-semibold mb-2">Log de Atividades:</h5>
                    {ticket.log && ticket.log.length > 0 ? (
                        <ul className="space-y-1 text-xs max-h-32 overflow-y-auto bg-slate-700/50 p-2 rounded">
                            {ticket.log.slice().reverse().map((entry, index) => ( 
                                <li key={index} className="p-1 rounded-sm">
                                    <strong className="text-indigo-400">{formatDateTime(entry.timestamp)}:</strong> {entry.action}
                                    {entry.reason && ` (Motivo: ${entry.reason})`}
                                    {entry.checklist && (
                                        <span className="text-gray-400 text-xs">
                                            (Ticket: {entry.checklist.respondeuTicket ? 'Sim' : 'Não'}, Planilha: {entry.checklist.respondeuPlanilha ? 'Sim' : 'Não'})
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-xs">Nenhuma atividade registrada.</p>
                    )}
                    <h5 className="text-sm font-semibold mt-3 mb-1">Checklist Atual:</h5>
                    <ul className="text-xs space-y-1">
                        <li className="flex items-center">
                            {ticket.checklist?.respondeuTicket ? <CheckCircle size={14} className="text-green-400 mr-1"/> : <XCircle size={14} className="text-red-400 mr-1"/>}
                            Respondeu Ticket Principal
                        </li>
                         <li className="flex items-center">
                            {ticket.checklist?.respondeuPlanilha ? <CheckCircle size={14} className="text-green-400 mr-1"/> : <XCircle size={14} className="text-red-400 mr-1"/>}
                            Atualizou Planilha
                        </li>
                    </ul>
                </div>
            )}

            <StopTimerModal 
                isOpen={isStopModalOpen} 
                onClose={() => setIsStopModalOpen(false)} 
                onStopConfirm={handleStopConfirm}
                ticket={ticket}
            />
            <ConfirmationModal
                isOpen={isConfirmDeleteOpen}
                onClose={() => setIsConfirmDeleteOpen(false)}
                onConfirm={handleDelete}
                title="Confirmar Exclusão"
                message={`Tem certeza que deseja excluir o ticket "${ticket.subject}"? Esta ação não pode ser desfeita.`}
            />
        </div>
    );
};

const ReportsView = ({ userId, tickets }) => { /* ... sem alterações ... */ 
    const [reportType, setReportType] = useState('daily'); // 'daily', 'weekly'
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState(null);
    const [isLoadingReport, setIsLoadingReport] = useState(false);

    const generateReport = async () => {
        setIsLoadingReport(true);
        setReportData(null); 
        
        let filteredTickets = [];
        const localSelectedDate = new Date(selectedDate + "T00:00:00Z"); // Use Z for UTC to avoid timezone shifts from just date string

        if (reportType === 'daily') {
            const dayStart = new Date(localSelectedDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(localSelectedDate);
            dayEnd.setHours(23, 59, 59, 999);
            
            filteredTickets = tickets.filter(t => {
                const lastUpdated = t.last_updated_at ? new Date(t.last_updated_at) : (t.creation_time ? new Date(t.creation_time) : null);
                return lastUpdated && lastUpdated >= dayStart && lastUpdated <= dayEnd;
            });

            const dailySummary = filteredTickets.map(ticket => {
                let timeOnDay = 0; // This logic might need more complex calculation if tickets span multiple days
                let actionsOnDay = [];
                (ticket.log || []).forEach(logEntry => {
                    const logDate = new Date(logEntry.timestamp);
                    if (logDate.toDateString() === localSelectedDate.toDateString()) {
                        actionsOnDay.push(`${formatDateTime(logDate)}: ${logEntry.action} ${logEntry.reason ? '('+logEntry.reason+')':''}`);
                    }
                });
                // Simplified: if any action on day, report total elapsed time. More accurate would be to sum time spent *only* on that day.
                if (actionsOnDay.length > 0) timeOnDay = ticket.elapsed_time; 

                return {
                    id: ticket.id,
                    subject: ticket.subject,
                    timeSpentDisplay: formatTime(timeOnDay || 0), 
                    actions: actionsOnDay,
                };
            }).filter(t => t.actions.length > 0);
            setReportData({ type: 'daily', date: formatDate(localSelectedDate), summary: dailySummary });

        } else if (reportType === 'weekly') {
            const weekStart = new Date(localSelectedDate);
            weekStart.setDate(localSelectedDate.getDate() - localSelectedDate.getDay() + (localSelectedDate.getDay() === 0 ? -6 : 1)); // Assuming week starts on Monday
            weekStart.setHours(0, 0, 0, 0);
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            filteredTickets = tickets.filter(t => {
                const lastUpdated = t.last_updated_at ? new Date(t.last_updated_at) : (t.creation_time ? new Date(t.creation_time) : null);
                return lastUpdated && lastUpdated >= weekStart && lastUpdated <= weekEnd;
            });
            const weeklySummary = filteredTickets.map(ticket => ({
                id: ticket.id,
                subject: ticket.subject,
                totalTime: formatTime(ticket.elapsed_time || 0), 
                status: ticket.status,
            }));

            setReportData({ type: 'weekly', startDate: formatDate(weekStart), endDate: formatDate(weekEnd), summary: weeklySummary });
        }
        
        setIsLoadingReport(false);
    };

    // JSX do ReportsView permanece visualmente o mesmo
    return (
        <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
            <h2 className="text-2xl font-semibold mb-6 text-gray-100">Relatórios</h2>
            <div className="flex flex-col sm:flex-row gap-4 mb-6 items-end">
                <div>
                    <label htmlFor="reportType" className="block text-sm font-medium text-gray-300 mb-1">Tipo de Relatório</label>
                    <select id="reportType" value={reportType} onChange={(e) => setReportType(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900">
                        <option value="daily">Diário</option>
                        <option value="weekly">Semanal</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="selectedDate" className="block text-sm font-medium text-gray-300 mb-1">
                        {reportType === 'daily' ? 'Selecione o Dia' : 'Selecione o Início da Semana'}
                    </label>
                    <input type="date" id="selectedDate" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900" />
                </div>
                <button onClick={generateReport} disabled={isLoadingReport}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out flex items-center justify-center sm:w-auto w-full">
                    {isLoadingReport ? 'Gerando...' : 'Gerar Relatório'}
                </button>
            </div>

            {isLoadingReport && <p className="text-gray-300">Carregando relatório...</p>}
            
            {reportData && reportData.type === 'daily' && (
                <div>
                    <h3 className="text-xl font-semibold text-gray-200 mb-3">Relatório Diário - {reportData.date}</h3>
                    {reportData.summary.length === 0 ? <p className="text-gray-400">Nenhuma atividade encontrada para este dia.</p> : (
                        <ul className="space-y-3">
                            {reportData.summary.map(item => (
                                <li key={item.id} className="p-3 bg-slate-700 rounded-md">
                                    <p className="font-semibold text-indigo-400">{item.subject}</p>
                                    <p className="text-sm text-gray-300">Tempo Estimado no Dia: {item.timeSpentDisplay}</p>
                                    {item.actions.length > 0 && <p className="text-xs text-gray-400 mt-1">Ações Registradas:</p>}
                                    <ul className="list-disc list-inside ml-2 text-xs text-gray-400">
                                        {item.actions.map((action, i) => <li key={i}>{action}</li>)}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {reportData && reportData.type === 'weekly' && (
                 <div>
                    <h3 className="text-xl font-semibold text-gray-200 mb-3">Relatório Semanal ({reportData.startDate} - {reportData.endDate})</h3>
                     {reportData.summary.length === 0 ? <p className="text-gray-400">Nenhuma atividade encontrada para esta semana.</p> : (
                        <ul className="space-y-3">
                            {reportData.summary.map(item => (
                                <li key={item.id} className="p-3 bg-slate-700 rounded-md">
                                    <p className="font-semibold text-indigo-400">{item.subject}</p>
                                    <p className="text-sm text-gray-300">Tempo Total no Ticket: {item.totalTime}</p>
                                    <p className="text-sm text-gray-400">Status: {item.status}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};


// --- Componente Principal App ---
function App() {
    const ticketRepository = useTicketRepository(); // Obtém o serviço
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [tickets, setTickets] = useState([]);
    const [activeTicketId, setActiveTicketId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showTicketForm, setShowTicketForm] = useState(false);
    const [currentView, setCurrentView] = useState('tickets');
    const [editingTicket, setEditingTicket] = useState(null); 
    const [ticketFilter, setTicketFilter] = useState('abertos');

    // Simplified Authentication
    useEffect(() => {
        // In a real app, this would involve a login screen or other auth mechanism
        setUserId('local-dev-user'); // Fixed user ID
        setIsAuthReady(true);
    }, []);
    
    // Listener de Tickets usando o serviço (PostgreSQL)
    useEffect(() => {
        if (!isAuthReady || !userId) {
            setTickets([]); setActiveTicketId(null); setIsLoading(false);
            return;
        }
        
        setIsLoading(true);
        const unsubscribe = ticketRepository.subscribeToTickets(userId, (updatedTickets, currentActiveId, error) => {
            if (error) {
                console.error("Falha ao carregar tickets:", error);
                setIsLoading(false);
                // TODO: Mostrar mensagem de erro na UI
                return;
            }
            setTickets(updatedTickets);
            setActiveTicketId(currentActiveId);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [isAuthReady, userId, ticketRepository]);


    // Lógica de Negócio / Casos de Uso
    const addLogEntryToTicketObject = (ticketLog, action, reason = null, checklistState = null) => {
        const newLogEntry = {
            timestamp: new Date(), // Use JS Date
            action: action,
            ...(reason && { reason: reason }),
            ...(checklistState && { checklist: checklistState })
        };
        const currentLog = Array.isArray(ticketLog) ? ticketLog : [];
        return [...currentLog, newLogEntry];
    };
    
    const handleToggleTimer = useCallback(async (ticketIdToToggle, currentStatus, reason = null, checklist = null, isCompleting = false) => {
        if (!userId) return;
        
        const currentTicketData = await ticketRepository.getTicket(userId, String(ticketIdToToggle)); // Ensure ID is string if needed
        if (!currentTicketData) {
            console.error("Ticket not found for toggling:", ticketIdToToggle);
            return;
        }

        let updateData = {};
        let newLog = currentTicketData.log || [];

        // Field names should match the database/service layer expectations
        if (!(currentTicketData.is_active && currentTicketData.status === 'Em Progresso')) { // Start/Resume
            if (activeTicketId && activeTicketId !== ticketIdToToggle) {
                const activeTicketRunningData = await ticketRepository.getTicket(userId, String(activeTicketId));
                if (activeTicketRunningData && activeTicketRunningData.status === 'Em Progresso' && activeTicketRunningData.current_timer_start_time) {
                    const activeStartTime = activeTicketRunningData.current_timer_start_time instanceof Date ? activeTicketRunningData.current_timer_start_time : new Date(activeTicketRunningData.current_timer_start_time);
                    const activeSessionSeconds = Math.floor((new Date().getTime() - activeStartTime.getTime()) / 1000);
                    
                    await ticketRepository.updateTicket(userId, String(activeTicketId), {
                        elapsed_time: (activeTicketRunningData.elapsed_time || 0) + activeSessionSeconds,
                        is_active: false,
                        status: 'Pausado',
                        current_timer_start_time: null,
                        log: addLogEntryToTicketObject(activeTicketRunningData.log, 'Pausado automaticamente (outra tarefa iniciada)'),
                    });
                }
            }
            updateData = {
                status: 'Em Progresso',
                is_active: true,
                current_timer_start_time: new Date(), // JS Date
                log: addLogEntryToTicketObject(newLog, currentTicketData.status === 'Pausado' ? 'Tarefa Retomada' : 'Tarefa Iniciada'),
            };
        } else { // Pause/Stop/Complete
            const startTime = currentTicketData.current_timer_start_time instanceof Date ? currentTicketData.current_timer_start_time : new Date(currentTicketData.current_timer_start_time);
            const sessionSeconds = currentTicketData.current_timer_start_time ? Math.floor((new Date().getTime() - startTime.getTime()) / 1000) : 0;
            
            updateData = {
                elapsed_time: (currentTicketData.elapsed_time || 0) + sessionSeconds,
                is_active: false,
                current_timer_start_time: null,
                checklist: checklist || currentTicketData.checklist,
            };
            if (isCompleting) {
                updateData.status = 'Concluído';
                updateData.log = addLogEntryToTicketObject(newLog, 'Tarefa Concluída', reason, checklist);
            } else {
                updateData.status = 'Pausado';
                updateData.log = addLogEntryToTicketObject(newLog, 'Tarefa Pausada', reason);
            }
        }
        
        try {
            await ticketRepository.updateTicket(userId, String(ticketIdToToggle), updateData);
        } catch (error) {
            console.error("Error toggling timer:", error);
        }
    }, [userId, activeTicketId, ticketRepository]);

    const handleDeleteTicket = async (ticketId) => {
        if (!userId) return;
        try {
            await ticketRepository.deleteTicket(userId, String(ticketId)); // Ensure ID is string
        } catch (error) {
            console.error("Error deleting ticket:", error);
        }
    };

    const handleEditTicket = (ticket) => { setEditingTicket(ticket); setShowTicketForm(true); };
    const handleTicketFormClose = () => { setShowTicketForm(false); setEditingTicket(null); };

    // Memoização para tickets filtrados e ordenados
    const filteredTickets = useMemo(() => {
        let sortedTickets = [...tickets];
        sortedTickets.sort((a, b) => {
            const priorityOrder = { "Solicitado por Terceiros": 0, "Alto Impacto": 1, "Médio Impacto": 2, "Baixo Impacto": 3 };
            const statusOrder = { 'Em Progresso': 1, 'Pausado': 2, 'Pendente': 3, 'Concluído': 4 };

            if (a.id === activeTicketId && b.id !== activeTicketId) return -1;
            if (b.id === activeTicketId && a.id !== activeTicketId) return 1;
            if (statusOrder[a.status] !== statusOrder[b.status]) {
                return statusOrder[a.status] - statusOrder[b.status];
            }
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            // Use DB field names and ensure Date objects
            const timeA = a.last_updated_at || a.creation_time || a.created_at;
            const timeB = b.last_updated_at || b.creation_time || b.created_at;

            const dateA = timeA ? (timeA instanceof Date ? timeA : new Date(timeA)) : null;
            const dateB = timeB ? (timeB instanceof Date ? timeB : new Date(timeB)) : null;

            if (dateA && dateB) return dateB.getTime() - dateA.getTime(); // Mais recente primeiro
            if (dateA) return -1; 
            if (dateB) return 1;  
            return 0;
        });
        
        if (ticketFilter === 'abertos') return sortedTickets.filter(t => t.status !== 'Concluído');
        if (ticketFilter === 'concluidos') return sortedTickets.filter(t => t.status === 'Concluído');
        return sortedTickets;
    }, [tickets, ticketFilter, activeTicketId]);

    const activeTicketDetails = useMemo(() => {
        if (!activeTicketId) return null;
        return tickets.find(t => t.id === activeTicketId);
    }, [activeTicketId, tickets]);
    
    const [headerTime, setHeaderTime] = useState(0);
    useEffect(() => {
        let intervalId;
        if (activeTicketDetails && activeTicketDetails.status === 'Em Progresso' && activeTicketDetails.current_timer_start_time) {
            const updateHeaderTime = () => {
                 const now = new Date();
                 const startTime = activeTicketDetails.current_timer_start_time instanceof Date 
                                 ? activeTicketDetails.current_timer_start_time 
                                 : new Date(activeTicketDetails.current_timer_start_time);
                 const sessionSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
                 setHeaderTime((activeTicketDetails.elapsed_time || 0) + sessionSeconds);
            };
            updateHeaderTime(); 
            intervalId = setInterval(updateHeaderTime, 1000);
        } else if (activeTicketDetails) {
            setHeaderTime(activeTicketDetails.elapsed_time || 0);
        } else {
            setHeaderTime(0);
        }
        return () => clearInterval(intervalId);
    }, [activeTicketDetails]);

    // JSX da Aplicação (Header, Main, Footer) - sem alterações visuais significativas
    if (!isAuthReady) { 
        return <div className="flex items-center justify-center min-h-screen bg-slate-900"><div className="text-xl font-semibold text-gray-300">Carregando aplicação...</div></div>;
    }
    // userId is now always set in simplified auth, so no specific !userId check needed here,
    // unless we want to show a different state before the fixed ID is set.

    return (
        <TicketRepositoryContext.Provider value={postgresTicketService}> {/* Fornece o serviço PostgreSQL */}
            <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-gray-100 font-sans">
                <header className="bg-slate-800/50 backdrop-blur-md shadow-lg p-4 sticky top-0 z-40">
                    <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
                        <div className="flex items-center space-x-2 mb-2 sm:mb-0">
                            <BarChart3 size={32} className="text-indigo-400" />
                            <h1 className="text-2xl font-bold tracking-tight text-white">Gerenciador de Tempo</h1>
                        </div>
                        <nav className="flex space-x-1 sm:space-x-3 items-center">
                            <button onClick={() => setCurrentView('tickets')} 
                                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'tickets' ? 'bg-indigo-500 text-white' : 'text-gray-300 hover:bg-slate-700 hover:text-white'}`}>
                                <ListChecks size={18} className="inline mr-1" /> Tickets
                            </button>
                            <button onClick={() => setCurrentView('reports')} 
                                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'reports' ? 'bg-indigo-500 text-white' : 'text-gray-300 hover:bg-slate-700 hover:text-white'}`}>
                                <FileText size={18} className="inline mr-1" /> Relatórios
                            </button>
                             <p className="text-xs text-gray-400 self-center hidden sm:block">UID: {userId.substring(0,10)}...</p>
                        </nav>
                    </div>
                </header>

                {activeTicketDetails && currentView === 'tickets' && (
                    <div className="bg-indigo-600 text-white p-3 shadow-md sticky top-[72px] sm:top-[68px] z-30">
                        <div className="container mx-auto text-center">
                            <p className="font-semibold text-sm sm:text-base">Trabalhando em: <span className="font-bold">{activeTicketDetails.subject}</span></p>
                            <p className="text-xl sm:text-2xl font-mono tracking-wider">{formatTime(headerTime || 0)}</p>
                        </div>
                    </div>
                )}
                
                <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                    {currentView === 'tickets' && (
                        <>
                            <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="flex items-center space-x-2 p-2 bg-slate-800 rounded-lg">
                                    <Filter size={20} className="text-indigo-400"/>
                                    <select value={ticketFilter} onChange={(e) => setTicketFilter(e.target.value)}
                                        className="bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm">
                                        <option value="abertos">Abertos</option>
                                        <option value="concluidos">Concluídos</option>
                                        <option value="todos">Todos</option>
                                    </select>
                                </div>
                                <button onClick={() => { setEditingTicket(null); setShowTicketForm(prev => !prev);}}
                                    className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out flex items-center space-x-2 w-full sm:w-auto justify-center">
                                    <PlusCircle size={20} />
                                    <span>{showTicketForm && !editingTicket ? 'Fechar Formulário' : (editingTicket ? 'Fechar Edição' : 'Adicionar Ticket')}</span>
                                </button>
                            </div>

                            {(showTicketForm || editingTicket) && (
                                <TicketForm 
                                    userId={userId} 
                                    onTicketAdded={() => {setShowTicketForm(false); setEditingTicket(null);}}
                                    ticketToEdit={editingTicket}
                                    onTicketUpdated={handleTicketFormClose}
                                    onCancelEdit={handleTicketFormClose}
                                />
                            )}

                            {isLoading && <div className="text-center py-10 text-gray-300">Carregando tickets...</div>}
                            {!isLoading && filteredTickets.length === 0 && !showTicketForm && (
                                <div className="text-center py-10 bg-slate-800 rounded-lg shadow-md">
                                    <p className="text-xl text-gray-400">Nenhum ticket encontrado para o filtro atual.</p>
                                    {ticketFilter === 'abertos' && <p className="text-gray-500">Adicione um novo ticket para começar ou altere o filtro.</p>}
                                </div>
                            )}
                            {!isLoading && filteredTickets.length > 0 && (
                                <div className="space-y-4">
                                    {filteredTickets.map(ticket => (
                                        <TicketItem 
                                            key={ticket.id} // Assuming ID from DB is unique and suitable as key
                                            ticket={ticket} 
                                            onToggleTimer={handleToggleTimer}
                                            onDeleteTicket={handleDeleteTicket}
                                            onEditTicket={handleEditTicket}
                                            activeTicketId={activeTicketId}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                    {currentView === 'reports' && (
                        <ReportsView userId={userId} tickets={tickets} />
                    )}
                </main>
                <footer className="text-center py-6 text-sm text-gray-500 border-t border-slate-700 mt-10">
                    <p>&copy; {new Date().getFullYear()} Gerenciador de Tempo. User: {userId}</p>
                </footer>
            </div>
        </TicketRepositoryContext.Provider>
    );
}

export default App;


