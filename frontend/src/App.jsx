import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { Clock, Play, Pause, PlusCircle, CalendarDays, Trash2, Edit3, ListChecks, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Save, Filter, FileText, BarChart3, RefreshCw } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const apiTicketService = {
    _normalizeTicketFromApi: (apiTicket) => ({
        ...apiTicket,
        isActive: Boolean(apiTicket.isActive),
    }),
    _prepareTicketForApi: (appTicket) => ({ ...appTicket }),

    async getTickets() {
        try {
            const response = await fetch(`${API_BASE_URL}/tickets`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();
            return result.data.map(this._normalizeTicketFromApi);
        } catch (error) { console.error("Erro ao buscar tickets:", error); throw error; }
    },
    async getTicket(ticketId) {
        try {
            const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}`);
            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return this._normalizeTicketFromApi(result.data);
        } catch (error) { console.error(`Erro ao buscar ticket ${ticketId}:`, error); throw error; }
    },
    async addTicket(ticketData) {
        try {
            const response = await fetch(`${API_BASE_URL}/tickets`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this._prepareTicketForApi(ticketData)),
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();
            return this._normalizeTicketFromApi(result.data);
        } catch (error) { console.error("Erro ao adicionar ticket:", error); throw error; }
    },
    async updateTicket(ticketId, ticketData) {
        try {
            const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this._prepareTicketForApi(ticketData)),
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();
            return this._normalizeTicketFromApi(result.data);
        } catch (error) { console.error(`Erro ao atualizar ticket ${ticketId}:`, error); throw error; }
    },
    async deleteTicket(ticketId) {
        try {
            const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return { id: ticketId, message: "deleted" };
        } catch (error) { console.error(`Erro ao deletar ticket ${ticketId}:`, error); throw error; }
    }
};

const TicketRepositoryContext = createContext(apiTicketService);
const useTicketRepository = () => useContext(TicketRepositoryContext);

const formatTime = (totalSeconds = 0) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};
const formatDateFromISO = (isoString) => {
    if (!isoString) return 'N/A';
    try { return new Date(isoString).toLocaleDateString('pt-BR', { timeZone: 'UTC' }); }
    catch (e) { return 'Data inválida'; }
};
const formatDateTimeFromISO = (isoString) => {
    if (!isoString) return 'N/A';
    try { return new Date(isoString).toLocaleString('pt-BR', { timeZone: 'UTC' }); }
    catch (e) { return 'Data/Hora inválida'; }
};

const Modal = ({ isOpen, onClose, title, children, size = 'max-w-md' }) => { 
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className={`bg-white p-6 rounded-lg shadow-xl w-full ${size} transform transition-all text-gray-900`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><XCircle size={24} /></button>
                </div>
                {children}
            </div>
        </div>
    );
};
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
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

// Função utilitária para buscar clientes
async function fetchClients() {
    const res = await fetch(`${API_BASE_URL}/clients`);
    const data = await res.json();
    return data.data || [];
}

// Modal para cadastrar cliente
function ClientModal({ isOpen, onClose, onClientAdded }) {
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!name.trim()) { setError('Nome é obrigatório'); return; }
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/clients`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (!res.ok) {
                const data = await res.json();
                setError(data.error || 'Erro ao cadastrar cliente');
                setLoading(false);
                return;
            }
            setName('');
            setLoading(false);
            onClientAdded && onClientAdded();
            onClose();
        } catch (err) {
            setError('Erro ao cadastrar cliente');
            setLoading(false);
        }
    };
    useEffect(() => { if (!isOpen) { setName(''); setError(''); setLoading(false); } }, [isOpen]);
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Cadastrar Cliente">
            <form onSubmit={handleSubmit} className="space-y-4">
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nome do Cliente" className="w-full p-2 border rounded" />
                {error && <div className="text-red-500 text-sm">{error}</div>}
                <div className="flex justify-end space-x-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300" disabled={loading}>Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</button>
                </div>
            </form>
        </Modal>
    );
}

const TicketForm = ({ onTicketAdded, ticketToEdit, onTicketUpdated, onCancelEdit }) => {
    const ticketRepository = useTicketRepository();
    const [ticketIdInput, setTicketIdInput] = useState('');
    const [subject, setSubject] = useState('');
    const [accountName, setAccountName] = useState('');
    const [priority, setPriority] = useState('Médio Impacto');
    const [difficulty, setDifficulty] = useState('Médio');
    const [creationDate, setCreationDate] = useState(new Date().toISOString().split('T')[0]);
    const [formMessage, setFormMessage] = useState({ text: '', type: '' });
    const [clients, setClients] = useState([]);
    const [clientSearch, setClientSearch] = useState('');
    const [showClientModal, setShowClientModal] = useState(false);

    useEffect(() => {
        if (ticketToEdit) {
            setTicketIdInput(ticketToEdit.ticketIdInput || '');
            setSubject(ticketToEdit.subject || '');
            setAccountName(ticketToEdit.accountName || '');
            setPriority(ticketToEdit.priority || 'Médio Impacto');
            setDifficulty(ticketToEdit.difficulty || 'Médio');
            setCreationDate(ticketToEdit.creationTime ? new Date(ticketToEdit.creationTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        } else {
            setTicketIdInput(''); setSubject(''); setAccountName('');
            setPriority('Médio Impacto'); setDifficulty('Médio');
            setCreationDate(new Date().toISOString().split('T')[0]);
        }
        setFormMessage({ text: '', type: '' });
    }, [ticketToEdit]);

    useEffect(() => {
        fetchClients().then(setClients);
    }, [showClientModal]);

    useEffect(() => {
        if (ticketToEdit && ticketToEdit.accountName) {
            setClientSearch(ticketToEdit.accountName);
            setAccountName(ticketToEdit.accountName);
        } else {
            setClientSearch('');
        }
    }, [ticketToEdit]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormMessage({ text: '', type: '' });
        if (!subject.trim()) {
            setFormMessage({ text: "Assunto do ticket é obrigatório.", type: "error" });
            return;
        }
        const ticketDataObject = {
            ticketIdInput: ticketIdInput.trim() || `T-${Date.now().toString().slice(-6)}`,
            subject: subject.trim(), accountName: accountName.trim(), priority, difficulty,
            creationTime: new Date(creationDate + "T00:00:00.000Z").toISOString(),
            status: ticketToEdit ? ticketToEdit.status : 'Pendente',
            elapsedTime: ticketToEdit ? ticketToEdit.elapsedTime || 0 : 0,
            isActive: ticketToEdit ? ticketToEdit.isActive || false : false,
            log: ticketToEdit ? ticketToEdit.log || [] : [],
            checklist: ticketToEdit ? ticketToEdit.checklist || { respondeuTicket: false, respondeuPlanilha: false } : { respondeuTicket: false, respondeuPlanilha: false },
            currentTimerStartTime: ticketToEdit ? ticketToEdit.currentTimerStartTime : null,
        };
        if (ticketToEdit && ticketToEdit.createdAt) {
             ticketDataObject.createdAt = ticketToEdit.createdAt;
        }

        try {
            if (ticketToEdit) {
                await ticketRepository.updateTicket(ticketToEdit.id, ticketDataObject);
                if (onTicketUpdated) onTicketUpdated();
                setFormMessage({ text: "Ticket atualizado com sucesso!", type: "success" });
            } else {
                await ticketRepository.addTicket(ticketDataObject);
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
            setFormMessage({ text: `Erro ao salvar ticket: ${error.message || 'Erro desconhecido'}`, type: "error" });
        }
    };

    const handleClientInput = (e) => {
        setClientSearch(e.target.value);
        setAccountName(e.target.value);
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 bg-slate-800 rounded-lg shadow mb-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-100 mb-3">{ticketToEdit ? 'Editar Ticket' : 'Adicionar Novo Ticket'}</h3>
            {formMessage.text && <p className={`text-sm mb-3 p-2 rounded ${formMessage.type === 'error' ? 'bg-red-500/30 text-red-300' : 'bg-green-500/30 text-green-300'}`}>{formMessage.text}</p>}
            <div><label htmlFor="ticketIdInput" className="block text-sm font-medium text-gray-300">ID do Ticket (Opcional)</label><input type="text" id="ticketIdInput" value={ticketIdInput} onChange={(e) => setTicketIdInput(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900" /></div>
            <div><label htmlFor="subject" className="block text-sm font-medium text-gray-300">Assunto *</label><input type="text" id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900" /></div>
            <div>
                <label htmlFor="accountName" className="block text-sm font-medium text-gray-300">Cliente</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        id="accountName"
                        value={clientSearch}
                        onChange={handleClientInput}
                        placeholder="Buscar ou digitar cliente"
                        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900"
                        list="client-list"
                        autoComplete="off"
                    />
                    <button type="button" onClick={() => setShowClientModal(true)} className="px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-xs">Novo Cliente</button>
                </div>
                <datalist id="client-list">
                    {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                        <option key={c.id} value={c.name} />
                    ))}
                </datalist>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label htmlFor="priority" className="block text-sm font-medium text-gray-300">Prioridade</label><select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900"><option value="Solicitado por Terceiros">Solicitado por Terceiros</option><option value="Alto Impacto">Alto Impacto</option><option value="Médio Impacto">Médio Impacto</option><option value="Baixo Impacto">Baixo Impacto</option></select></div>
                <div><label htmlFor="difficulty" className="block text-sm font-medium text-gray-300">Dificuldade</label><select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900"><option value="Fácil">Fácil</option><option value="Médio">Médio</option><option value="Difícil">Difícil</option></select></div>
            </div>
            <div><label htmlFor="creationDate" className="block text-sm font-medium text-gray-300">Data de Criação</label><input type="date" id="creationDate" value={creationDate} onChange={(e) => setCreationDate(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900" /></div>
            <div className="flex justify-end space-x-2">
                 {ticketToEdit && (<button type="button" onClick={onCancelEdit} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-300 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Cancelar Edição</button>)}
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center space-x-2"><Save size={18} /><span>{ticketToEdit ? 'Salvar Alterações' : 'Adicionar Ticket'}</span></button>
            </div>
            <ClientModal isOpen={showClientModal} onClose={() => setShowClientModal(false)} onClientAdded={() => fetchClients().then(setClients)} />
        </form>
    );
};

const StopTimerModal = ({ isOpen, onClose, onStopConfirm, ticket }) => {
    const [reason, setReason] = useState('');
    const [respondeuTicket, setRespondeuTicket] = useState(false);
    const [respondeuPlanilha, setRespondeuPlanilha] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false); 
    const [modalMessage, setModalMessage] = useState('');

    useEffect(() => {
        if (isOpen && ticket) { 
            setRespondeuTicket(ticket.checklist?.respondeuTicket || false);
            setRespondeuPlanilha(ticket.checklist?.respondeuPlanilha || false);
            setReason(''); setModalMessage(''); setIsCompleting(false); 
        }
    }, [isOpen, ticket]);

    const handleConfirmWrapper = (completeTask) => {
        setModalMessage(''); 
        if (!completeTask && !reason.trim()) { setModalMessage("O motivo da pausa é obrigatório."); return; }
        if (completeTask && (!respondeuTicket || !respondeuPlanilha)) { setModalMessage("Por favor, confirme que respondeu ao ticket e à planilha antes de completar."); return; }
        onStopConfirm(reason, { respondeuTicket, respondeuPlanilha }, completeTask);
        onClose();
    };

    if (!ticket) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isCompleting ? `Completar Ticket: ${ticket.subject}` : `Pausar Ticket: ${ticket.subject}`}>
            <div className="space-y-4">
                {modalMessage && <p className="text-red-500 text-sm mb-2 p-2 bg-red-100 rounded">{modalMessage}</p>}
                {!isCompleting && (<div><label htmlFor="reason" className="block text-sm font-medium text-gray-700">Motivo da Pausa *</label><textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows="3" required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900" placeholder="Ex: Reunião, Almoço, Mudei para outra tarefa..." /></div>)}
                {isCompleting && (<div className="space-y-2 pt-2"><p className="text-sm font-medium text-gray-700">Checklist de Finalização *</p><label className="flex items-center space-x-2 text-sm text-gray-600"><input type="checkbox" checked={respondeuTicket} onChange={(e) => setRespondeuTicket(e.target.checked)} className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" /><span>Respondeu o ticket na plataforma principal?</span></label><label className="flex items-center space-x-2 text-sm text-gray-600"><input type="checkbox" checked={respondeuPlanilha} onChange={(e) => setRespondeuPlanilha(e.target.checked)} className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" /><span>Atualizou a planilha de controle?</span></label></div>)}
                <div className="flex justify-end space-x-3 pt-4"><button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">Cancelar</button><button onClick={() => { setIsCompleting(false); handleConfirmWrapper(false); }} className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600">Pausar Tarefa</button><button onClick={() => { setIsCompleting(true); handleConfirmWrapper(true); }} className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600">Completar Tarefa</button></div>
            </div>
        </Modal>
    );
};

const TicketItem = ({ ticket, onToggleTimer, onDeleteTicket, onEditTicket, activeTicketId }) => {
    const [currentElapsedTime, setCurrentElapsedTime] = useState(ticket.elapsedTime || 0);
    const [timerIntervalId, setTimerIntervalId] = useState(null);
    const [isStopModalOpen, setIsStopModalOpen] = useState(false);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const isActive = ticket.id === activeTicketId;

    useEffect(() => {
        setCurrentElapsedTime(ticket.elapsedTime || 0);
        if (isActive && ticket.status === 'Em Progresso' && ticket.currentTimerStartTime) {
            const startTime = new Date(ticket.currentTimerStartTime).getTime();
            const updateTimer = () => {
                const now = Date.now();
                const sessionSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
                setCurrentElapsedTime((ticket.elapsedTime || 0) + sessionSeconds);
            };
            updateTimer(); // Update immediately
            const intervalId = setInterval(updateTimer, 1000);
            setTimerIntervalId(intervalId);
            return () => clearInterval(intervalId);
        } else if (timerIntervalId) {
            clearInterval(timerIntervalId);
            setTimerIntervalId(null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive, ticket.status, ticket.currentTimerStartTime, ticket.elapsedTime]);

    const handleToggle = () => { if (isActive && ticket.status === 'Em Progresso') { setIsStopModalOpen(true); } else { if (ticket.status !== 'Concluído') { onToggleTimer(ticket.id, ticket.status); }}};
    const handleStopConfirm = async (reason, checklist, isCompleting) => { await onToggleTimer(ticket.id, ticket.status, reason, checklist, isCompleting); setIsStopModalOpen(false); };
    const handleDelete = () => { onDeleteTicket(ticket.id); setIsConfirmDeleteOpen(false); };
    const getPriorityClass = (priority) => { if (priority === 'Solicitado por Terceiros') return 'text-purple-400 font-bold'; if (priority === 'Alto Impacto') return 'text-red-400'; if (priority === 'Médio Impacto') return 'text-yellow-400'; return 'text-blue-400'; };
    const getStatusStyles = () => { switch (ticket.status) { case 'Em Progresso': return { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500', itemText: 'text-gray-100' }; case 'Pausado': return { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500', itemText: 'text-gray-100' }; case 'Concluído': return { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500', itemText: 'text-gray-300' }; case 'Pendente': return { bg: 'bg-slate-700', text: 'text-gray-400', border: 'border-slate-600', itemText: 'text-gray-200' }; default: return { bg: 'bg-slate-700', text: 'text-gray-400', border: 'border-slate-600', itemText: 'text-gray-200'};}};
    const styles = getStatusStyles();

    return (
        <div className={`p-4 rounded-lg shadow-md border-l-4 ${styles.bg} ${styles.border} mb-4 transition-all duration-300`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className={`flex-grow mb-3 sm:mb-0 ${styles.itemText}`}>
                    <div className="flex items-center justify-between"><h4 className={`text-lg font-semibold ${styles.itemText}`}>{ticket.subject}</h4><button onClick={() => setExpanded(!expanded)} className={`p-1 ${styles.text} hover:text-indigo-400`}>{expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button></div>
                    <p className="text-sm ">ID: {ticket.ticketIdInput} | Conta: {ticket.accountName || 'N/A'}</p>
                    <p className="text-sm ">Prioridade: <span className={getPriorityClass(ticket.priority)}>{ticket.priority}</span> | Dificuldade: {ticket.difficulty}</p>
                    <p className="text-sm ">Criado em: {formatDateFromISO(ticket.creationTime)}</p>
                    <p className={`text-sm font-medium ${styles.text}`}>Status: {ticket.status}</p>
                </div>
                <div className="flex flex-col items-end space-y-2 w-full sm:w-auto">
                    <div className="text-2xl font-mono text-indigo-400 tracking-wider"><Clock size={22} className="inline mr-2" />{formatTime(currentElapsedTime)}</div>
                    <div className="flex space-x-2">
                        {ticket.status !== 'Concluído' && (<button onClick={handleToggle} className={`p-2 rounded-md text-white transition-colors duration-150 flex items-center space-x-1 text-sm ${isActive && ticket.status === 'Em Progresso' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>{isActive && ticket.status === 'Em Progresso' ? <Pause size={16} /> : <Play size={16} />}<span>{isActive && ticket.status === 'Em Progresso' ? 'Pausar/Parar' : (ticket.status === 'Pausado' ? 'Retomar' : 'Iniciar')}</span></button>)}
                        <button onClick={() => onEditTicket(ticket)} title="Editar Ticket" className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-150"><Edit3 size={16} /></button>
                        <button onClick={() => setIsConfirmDeleteOpen(true)} title="Excluir Ticket" className="p-2 bg-slate-600 text-white rounded-md hover:bg-slate-500 transition-colors duration-150"><Trash2 size={16} /></button>
                    </div>
                </div>
            </div>
            {expanded && (
                <div className={`mt-4 pt-3 border-t ${styles.border} border-opacity-50 ${styles.itemText}`}>
                    <h5 className="text-sm font-semibold mb-2">Log de Atividades:</h5>
                    {ticket.log && ticket.log.length > 0 ? (<ul className="space-y-1 text-xs max-h-32 overflow-y-auto bg-slate-700/50 p-2 rounded">{ticket.log.slice().reverse().map((entry, index) => (<li key={index} className="p-1 rounded-sm"><strong className="text-indigo-400">{formatDateTimeFromISO(entry.timestamp)}:</strong> {entry.action}{entry.reason && ` (Motivo: ${entry.reason})`}{entry.checklist && (<span className="text-gray-400 text-xs">(Ticket: {entry.checklist.respondeuTicket ? 'Sim' : 'Não'}, Planilha: {entry.checklist.respondeuPlanilha ? 'Sim' : 'Não'})</span>)}</li>))}</ul>) : (<p className="text-xs">Nenhuma atividade registrada.</p>)}
                    <h5 className="text-sm font-semibold mt-3 mb-1">Checklist Atual:</h5>
                    <ul className="text-xs space-y-1"><li className="flex items-center">{ticket.checklist?.respondeuTicket ? <CheckCircle size={14} className="text-green-400 mr-1"/> : <XCircle size={14} className="text-red-400 mr-1"/>}Respondeu Ticket Principal</li><li className="flex items-center">{ticket.checklist?.respondeuPlanilha ? <CheckCircle size={14} className="text-green-400 mr-1"/> : <XCircle size={14} className="text-red-400 mr-1"/>}Atualizou Planilha</li></ul>
                </div>
            )}
            <StopTimerModal isOpen={isStopModalOpen} onClose={() => setIsStopModalOpen(false)} onStopConfirm={handleStopConfirm} ticket={ticket} />
            <ConfirmationModal isOpen={isConfirmDeleteOpen} onClose={() => setIsConfirmDeleteOpen(false)} onConfirm={handleDelete} title="Confirmar Exclusão" message={`Tem certeza que deseja excluir o ticket "${ticket.subject}"? Esta ação não pode ser desfeita.`} />
        </div>
    );
};

const ReportsView = ({ tickets }) => {
    const [reportType, setReportType] = useState('daily');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState(null);
    const [isLoadingReport, setIsLoadingReport] = useState(false);

    const generateReport = () => {
        setIsLoadingReport(true); setReportData(null);
        const date = new Date(selectedDate + "T00:00:00Z");
        if (reportType === 'daily') {
            const dailySummary = tickets.map(ticket => {
                let actionsOnDay = [];
                (ticket.log || []).forEach(logEntry => { if (new Date(logEntry.timestamp).toDateString() === date.toDateString()) { actionsOnDay.push(`${formatDateTimeFromISO(logEntry.timestamp)}: ${logEntry.action} ${logEntry.reason ? '('+logEntry.reason+')':''}`); }});
                return { id: ticket.id, subject: ticket.subject, timeSpentDisplay: actionsOnDay.length > 0 ? formatTime(ticket.elapsedTime) : formatTime(0), actions: actionsOnDay, };
            }).filter(t => t.actions.length > 0);
            setReportData({ type: 'daily', date: formatDateFromISO(date.toISOString()), summary: dailySummary });
        } else if (reportType === 'weekly') {
            const weekStart = new Date(date); weekStart.setUTCDate(date.getUTCDate() - date.getUTCDay());
            const weekEnd = new Date(weekStart); weekEnd.setUTCDate(weekStart.getUTCDate() + 6); weekEnd.setUTCHours(23,59,59,999);
            const weeklySummary = tickets.filter(t => { const ticketDate = new Date(t.lastUpdatedAt || t.createdAt); return ticketDate >= weekStart && ticketDate <= weekEnd; }).map(ticket => ({ id: ticket.id, subject: ticket.subject, totalTime: formatTime(ticket.elapsedTime), status: ticket.status, }));
            setReportData({ type: 'weekly', startDate: formatDateFromISO(weekStart.toISOString()), endDate: formatDateFromISO(weekEnd.toISOString()), summary: weeklySummary });
        }
        setIsLoadingReport(false);
    };
    return (
        <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
            <h2 className="text-2xl font-semibold mb-6 text-gray-100">Relatórios</h2>
            <div className="flex flex-col sm:flex-row gap-4 mb-6 items-end">
                <div><label htmlFor="reportType" className="block text-sm font-medium text-gray-300 mb-1">Tipo de Relatório</label><select id="reportType" value={reportType} onChange={(e) => setReportType(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900"><option value="daily">Diário</option><option value="weekly">Semanal</option></select></div>
                <div><label htmlFor="selectedDate" className="block text-sm font-medium text-gray-300 mb-1">{reportType === 'daily' ? 'Selecione o Dia' : 'Selecione o Início da Semana'}</label><input type="date" id="selectedDate" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900" /></div>
                <button onClick={generateReport} disabled={isLoadingReport} className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out flex items-center justify-center sm:w-auto w-full">{isLoadingReport ? 'Gerando...' : 'Gerar Relatório'}</button>
            </div>
            {isLoadingReport && <p className="text-gray-300">Carregando relatório...</p>}
            {reportData && reportData.type === 'daily' && (<div><h3 className="text-xl font-semibold text-gray-200 mb-3">Relatório Diário - {reportData.date}</h3>{reportData.summary.length === 0 ? <p className="text-gray-400">Nenhuma atividade encontrada para este dia.</p> : (<ul className="space-y-3">{reportData.summary.map(item => (<li key={item.id} className="p-3 bg-slate-700 rounded-md"><p className="font-semibold text-indigo-400">{item.subject}</p><p className="text-sm text-gray-300">Tempo Estimado no Dia: {item.timeSpentDisplay}</p>{item.actions.length > 0 && <p className="text-xs text-gray-400 mt-1">Ações Registradas:</p>}<ul className="list-disc list-inside ml-2 text-xs text-gray-400">{item.actions.map((action, i) => <li key={i}>{action}</li>)}</ul></li>))}</ul>)}</div>)}
            {reportData && reportData.type === 'weekly' && (<div><h3 className="text-xl font-semibold text-gray-200 mb-3">Relatório Semanal ({reportData.startDate} - {reportData.endDate})</h3>{reportData.summary.length === 0 ? <p className="text-gray-400">Nenhuma atividade encontrada para esta semana.</p> : (<ul className="space-y-3">{reportData.summary.map(item => (<li key={item.id} className="p-3 bg-slate-700 rounded-md"><p className="font-semibold text-indigo-400">{item.subject}</p><p className="text-sm text-gray-300">Tempo Total no Ticket: {item.totalTime}</p><p className="text-sm text-gray-400">Status: {item.status}</p></li>))}</ul>)}</div>)}
        </div>
    );
};

function App() {
    const ticketRepository = useTicketRepository();
    const [tickets, setTickets] = useState([]);
    const [activeTicketId, setActiveTicketId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showTicketForm, setShowTicketForm] = useState(false);
    const [currentView, setCurrentView] = useState('tickets');
    const [editingTicket, setEditingTicket] = useState(null); 
    const [ticketFilter, setTicketFilter] = useState('abertos');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [filterDifficulty, setFilterDifficulty] = useState('');
    const [filterClient, setFilterClient] = useState('');
    const [clients, setClients] = useState([]);

    const fetchTickets = useCallback(async () => {
        setIsLoading(true); setError(null);
        try {
            const fetchedTickets = await ticketRepository.getTickets();
            setTickets(fetchedTickets);
            const currentActive = fetchedTickets.find(t => t.isActive && t.status === 'Em Progresso');
            setActiveTicketId(currentActive ? currentActive.id : null);
        } catch (err) { console.error("Falha ao carregar tickets:", err); setError(err.message || "Erro ao carregar dados."); }
        finally { setIsLoading(false); }
    }, [ticketRepository]);

    useEffect(() => { fetchTickets(); }, [fetchTickets]);

    useEffect(() => { fetchClients().then(setClients); }, []);

    const addLogEntryToTicketObject = (ticketLog, action, reason = null, checklistState = null) => {
        const newLogEntry = { timestamp: new Date().toISOString(), action, ...(reason && { reason }), ...(checklistState && { checklist: checklistState }) };
        return [...(Array.isArray(ticketLog) ? ticketLog : []), newLogEntry];
    };
    
    const handleToggleTimer = useCallback(async (ticketIdToToggle, currentStatus, reason = null, checklist = null, isCompleting = false) => {
        const currentTicketData = tickets.find(t => t.id === ticketIdToToggle);
        if (!currentTicketData) return;
        let updatePayload = {};
        if (!(currentTicketData.isActive && currentTicketData.status === 'Em Progresso')) {
            if (activeTicketId && activeTicketId !== ticketIdToToggle) {
                const activeTicketRunningData = tickets.find(t => t.id === activeTicketId);
                if (activeTicketRunningData && activeTicketRunningData.status === 'Em Progresso' && activeTicketRunningData.currentTimerStartTime) {
                    const activeSessionSeconds = Math.floor((Date.now() - new Date(activeTicketRunningData.currentTimerStartTime).getTime()) / 1000);
                    try { await ticketRepository.updateTicket(activeTicketId, { ...activeTicketRunningData, elapsedTime: (activeTicketRunningData.elapsedTime || 0) + activeSessionSeconds, isActive: false, status: 'Pausado', currentTimerStartTime: null, log: addLogEntryToTicketObject(activeTicketRunningData.log, 'Pausado automaticamente (outra tarefa iniciada)') }); }
                    catch (err) { console.error("Erro ao pausar ticket ativo:", err); }
                }
            }
            updatePayload = { ...currentTicketData, status: 'Em Progresso', isActive: true, currentTimerStartTime: new Date().toISOString(), log: addLogEntryToTicketObject(currentTicketData.log, currentTicketData.status === 'Pausado' ? 'Tarefa Retomada' : 'Tarefa Iniciada') };
        } else {
            const sessionSeconds = currentTicketData.currentTimerStartTime ? Math.floor((Date.now() - new Date(currentTicketData.currentTimerStartTime).getTime()) / 1000) : 0;
            updatePayload = { ...currentTicketData, elapsedTime: (currentTicketData.elapsedTime || 0) + sessionSeconds, isActive: false, currentTimerStartTime: null, checklist: checklist || currentTicketData.checklist };
            if (isCompleting) { updatePayload.status = 'Concluído'; updatePayload.log = addLogEntryToTicketObject(currentTicketData.log, 'Tarefa Concluída', reason, checklist); }
            else { updatePayload.status = 'Pausado'; updatePayload.log = addLogEntryToTicketObject(currentTicketData.log, 'Tarefa Pausada', reason); }
        }
        try { await ticketRepository.updateTicket(ticketIdToToggle, updatePayload); fetchTickets(); }
        catch (err) { console.error("Error toggling timer:", err); setError(err.message || "Erro ao atualizar o timer."); }
    }, [tickets, activeTicketId, ticketRepository, fetchTickets]);

    const handleDeleteTicket = async (ticketId) => {
        try { await ticketRepository.deleteTicket(ticketId); fetchTickets(); }
        catch (err) { console.error("Error deleting ticket:", err); setError(err.message || "Erro ao deletar ticket."); }
    };
    const handleTicketAddedOrUpdated = () => { setShowTicketForm(false); setEditingTicket(null); fetchTickets(); };
    const handleEditTicket = (ticket) => { setEditingTicket(ticket); setShowTicketForm(true); };
    const handleTicketFormClose = () => { setShowTicketForm(false); setEditingTicket(null); };

    const filteredTickets = useMemo(() => {
        let sortedTickets = [...tickets];
        sortedTickets.sort((a, b) => {
            const priorityOrder = { "Solicitado por Terceiros": 0, "Alto Impacto": 1, "Médio Impacto": 2, "Baixo Impacto": 3 };
            const statusOrder = { 'Em Progresso': 1, 'Pausado': 2, 'Pendente': 3, 'Concluído': 4 };
            if (a.id === activeTicketId && b.id !== activeTicketId) return -1; if (b.id === activeTicketId && a.id !== activeTicketId) return 1;
            if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) return priorityOrder[a.priority] - priorityOrder[b.priority];
            const timeA = new Date(a.lastUpdatedAt || a.createdAt); const timeB = new Date(b.lastUpdatedAt || b.createdAt);
            return timeB - timeA;
        });
        let filtered = sortedTickets;
        if (ticketFilter === 'abertos') filtered = filtered.filter(t => t.status !== 'Concluído');
        if (ticketFilter === 'concluidos') filtered = filtered.filter(t => t.status === 'Concluído');
        if (filterStartDate) filtered = filtered.filter(t => t.creationTime && new Date(t.creationTime) >= new Date(filterStartDate));
        if (filterEndDate) filtered = filtered.filter(t => t.creationTime && new Date(t.creationTime) <= new Date(filterEndDate + 'T23:59:59'));
        if (filterPriority) filtered = filtered.filter(t => t.priority === filterPriority);
        if (filterDifficulty) filtered = filtered.filter(t => t.difficulty === filterDifficulty);
        if (filterClient) filtered = filtered.filter(t => t.accountName && t.accountName.toLowerCase().includes(filterClient.toLowerCase()));
        return filtered;
    }, [tickets, ticketFilter, activeTicketId, filterStartDate, filterEndDate, filterPriority, filterDifficulty, filterClient]);

    const activeTicketDetails = useMemo(() => { if (!activeTicketId) return null; return tickets.find(t => t.id === activeTicketId); }, [activeTicketId, tickets]);
    
    const [headerTime, setHeaderTime] = useState(0);
    useEffect(() => {
        let intervalId;
        if (activeTicketDetails && activeTicketDetails.status === 'Em Progresso' && activeTicketDetails.currentTimerStartTime) {
            const update = () => { const now = Date.now(); const startTime = new Date(activeTicketDetails.currentTimerStartTime).getTime(); const sessionSeconds = Math.floor((now - startTime) / 1000); setHeaderTime((activeTicketDetails.elapsedTime || 0) + sessionSeconds); };
            update(); intervalId = setInterval(update, 1000);
        } else if (activeTicketDetails) { setHeaderTime(activeTicketDetails.elapsedTime || 0); }
        else { setHeaderTime(0); }
        return () => clearInterval(intervalId);
    }, [activeTicketDetails]);

    return (
        <TicketRepositoryContext.Provider value={apiTicketService}>
            <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-gray-100 font-sans">
                <header className="bg-slate-800/50 backdrop-blur-md shadow-lg p-4 sticky top-0 z-40">
                    <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
                        <div className="flex items-center space-x-2 mb-2 sm:mb-0"><BarChart3 size={32} className="text-indigo-400" /><h1 className="text-2xl font-bold tracking-tight text-white">Gerenciador de Tempo Local</h1></div>
                        <nav className="flex space-x-1 sm:space-x-3 items-center">
                            <button onClick={() => setCurrentView('tickets')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'tickets' ? 'bg-indigo-500 text-white' : 'text-gray-300 hover:bg-slate-700 hover:text-white'}`}><ListChecks size={18} className="inline mr-1" /> Tickets</button>
                            <button onClick={() => setCurrentView('reports')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'reports' ? 'bg-indigo-500 text-white' : 'text-gray-300 hover:bg-slate-700 hover:text-white'}`}><FileText size={18} className="inline mr-1" /> Relatórios</button>
                            <button onClick={fetchTickets} title="Recarregar Tickets" className="p-2 text-gray-300 hover:bg-slate-700 hover:text-white rounded-md"><RefreshCw size={18} className={isLoading ? "animate-spin" : ""}/></button>
                        </nav>
                    </div>
                </header>
                {activeTicketDetails && currentView === 'tickets' && (<div className="bg-indigo-600 text-white p-3 shadow-md sticky top-[72px] sm:top-[68px] z-30"><div className="container mx-auto text-center"><p className="font-semibold text-sm sm:text-base">Trabalhando em: <span className="font-bold">{activeTicketDetails.subject}</span></p><p className="text-xl sm:text-2xl font-mono tracking-wider">{formatTime(headerTime)}</p></div></div>)}
                <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                    {error && (<div className="mb-4 p-3 bg-red-500/30 text-red-300 rounded-md text-center"><AlertTriangle size={20} className="inline mr-2"/> {error}</div>)}
                    {currentView === 'tickets' && (<>
                        <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex items-center space-x-2 p-2 bg-slate-800 rounded-lg">
                                <Filter size={20} className="text-indigo-400"/>
                                <select value={ticketFilter} onChange={(e) => setTicketFilter(e.target.value)} className="bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm">
                                    <option value="abertos">Abertos</option>
                                    <option value="concluidos">Concluídos</option>
                                    <option value="todos">Todos</option>
                                </select>
                                <button onClick={() => setShowAdvancedFilters(v => !v)} className="ml-2 px-2 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-700 text-white">{showAdvancedFilters ? 'Ocultar Filtros' : 'Filtros Avançados'}</button>
                            </div>
                            <button onClick={() => { setEditingTicket(null); setShowTicketForm(prev => !prev);}} className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out flex items-center space-x-2 w-full sm:w-auto justify-center"><PlusCircle size={20} /><span>{showTicketForm && !editingTicket ? 'Fechar Formulário' : (editingTicket ? 'Fechar Edição' : 'Adicionar Ticket')}</span></button>
                        </div>
                        {showAdvancedFilters && (
                            <div className="mb-4 flex flex-wrap gap-4 bg-slate-800 p-4 rounded-lg shadow">
                                <div>
                                    <label className="block text-xs text-gray-300 mb-1">Data Inicial</label>
                                    <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-300 mb-1">Data Final</label>
                                    <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-300 mb-1">Prioridade</label>
                                    <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm">
                                        <option value="">Todas</option>
                                        <option value="Solicitado por Terceiros">Solicitado por Terceiros</option>
                                        <option value="Alto Impacto">Alto Impacto</option>
                                        <option value="Médio Impacto">Médio Impacto</option>
                                        <option value="Baixo Impacto">Baixo Impacto</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-300 mb-1">Dificuldade</label>
                                    <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)} className="bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm">
                                        <option value="">Todas</option>
                                        <option value="Fácil">Fácil</option>
                                        <option value="Médio">Médio</option>
                                        <option value="Difícil">Difícil</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-300 mb-1">Cliente</label>
                                    <input
                                        type="text"
                                        value={filterClient}
                                        onChange={e => setFilterClient(e.target.value)}
                                        placeholder="Buscar cliente"
                                        className="bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm"
                                        list="filter-client-list"
                                    />
                                    <datalist id="filter-client-list">
                                        {clients.filter(c => c.name.toLowerCase().includes(filterClient.toLowerCase())).map(c => (
                                            <option key={c.id} value={c.name} />
                                        ))}
                                    </datalist>
                                </div>
                                <div className="flex items-end">
                                    <button onClick={() => { setFilterStartDate(''); setFilterEndDate(''); setFilterPriority(''); setFilterDifficulty(''); setFilterClient(''); }} className="ml-2 px-3 py-2 text-xs rounded bg-slate-600 hover:bg-slate-700 text-white">Limpar Filtros</button>
                                </div>
                            </div>
                        )}
                        {(showTicketForm || editingTicket) && (<TicketForm onTicketAdded={handleTicketAddedOrUpdated} ticketToEdit={editingTicket} onTicketUpdated={handleTicketAddedOrUpdated} onCancelEdit={handleTicketFormClose}/>)}
                        {isLoading && <div className="text-center py-10 text-gray-300">Carregando tickets...</div>}
                        {!isLoading && !error && filteredTickets.length === 0 && !showTicketForm && (<div className="text-center py-10 bg-slate-800 rounded-lg shadow-md"><p className="text-xl text-gray-400">Nenhum ticket encontrado para o filtro atual.</p>{ticketFilter === 'abertos' && <p className="text-gray-500">Adicione um novo ticket para começar ou altere o filtro.</p>}</div>)}
                        {!isLoading && !error && filteredTickets.length > 0 && (<div className="space-y-4">{filteredTickets.map(ticket => (<TicketItem key={ticket.id} ticket={ticket} onToggleTimer={handleToggleTimer} onDeleteTicket={handleDeleteTicket} onEditTicket={handleEditTicket} activeTicketId={activeTicketId}/>))}</div>)}
                    </>)}
                    {currentView === 'reports' && (<ReportsView tickets={tickets} />)}
                </main>
                <footer className="text-center py-6 text-sm text-gray-500 border-t border-slate-700 mt-10"><p>&copy; {new Date().getFullYear()} Gerenciador de Tempo Local.</p></footer>
            </div>
        </TicketRepositoryContext.Provider>
    );
}

export default App;