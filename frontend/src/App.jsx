import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { Clock, Play, Pause, PlusCircle, UserPlus, CalendarDays, Trash2, Edit3, ListChecks, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Save, Filter, FileText, BarChart3, RefreshCw } from 'lucide-react';

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

const ToastMessage = ({ message, type, onDismiss }) => {
    if (!message) return null;

    const baseStyle = "fixed top-5 right-5 p-4 rounded-lg shadow-xl text-white transition-all duration-500 ease-in-out opacity-0 animate-fadeInOut"; // Added animation classes
    const typeStyles = {
        success: "bg-green-500",
        error: "bg-red-500",
        info: "bg-blue-500"
    };
    
    // Simple keyframe animation for fadeInOut
    // For a real app, you might use a CSS file or a more robust animation library
    const animationStyle = `
        @keyframes fadeInOutAnimation {
            0% { opacity: 0; transform: translateY(-20px); }
            10% { opacity: 1; transform: translateY(0); }
            90% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-20px); }
        }
        .animate-fadeInOut {
            animation: fadeInOutAnimation 3s forwards;
        }
    `;

    return (
        <>
            <style>{animationStyle}</style>
            <div className={`${baseStyle} ${typeStyles[type] || typeStyles.info} z-[100]`}> {/* Ensure high z-index */}
                <span>{message}</span>
                <button 
                    onClick={onDismiss} 
                    className="ml-4 text-xl font-semibold leading-none hover:text-gray-200 focus:outline-none"
                    aria-label="Dismiss message"
                >
                    &times;
                </button>
            </div>
        </>
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
            <form onSubmit={handleSubmit} className="space-y-6"> {/* Increased space-y for better separation */}
                <div>
                    <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-1">Nome do Cliente *</label>
                    <input 
                        type="text" 
                        id="clientName"
                        value={name} 
                        onChange={e => setName(e.target.value.toUpperCase())} 
                        placeholder="Nome do Cliente" 
                        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900" 
                    />
                </div>
                {error && <div className="text-red-600 text-sm p-2 bg-red-100 rounded-md">{error}</div>} {/* Enhanced error display */}
                <div className="flex justify-end space-x-3 pt-2"> {/* Added pt-2 and increased space-x */}
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md border border-gray-300 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" 
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit" 
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center" 
                        disabled={loading}
                    >
                        {loading ? (
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : <Save size={18} className="mr-2"/>}
                        {loading ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// --- Renamed TicketForm to TicketModal and adjusted props & logic ---
const TicketModal = ({ 
    isOpen, 
    onClose, 
    ticketToEdit, 
    onTicketAddedOrUpdated, 
    clients, 
    showToast,
    onOpenClientModal 
}) => {
    const ticketRepository = useTicketRepository();
    const [ticketIdInput, setTicketIdInput] = useState('');
    const [subject, setSubject] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [priority, setPriority] = useState('Médio Impacto');
    const [difficulty, setDifficulty] = useState('Médio');
    const [creationDate, setCreationDate] = useState(new Date().toISOString().split('T')[0]);
    const [formMessage, setFormMessage] = useState({ text: '', type: '' });
    // Removed local clients state and showClientModal state

    useEffect(() => {
        if (isOpen) { // Only run when modal is open
            if (ticketToEdit) {
                setTicketIdInput(ticketToEdit.ticketIdInput || '');
                setSubject(ticketToEdit.subject || '');
                setSelectedClientId(ticketToEdit.clientId || '');
                setPriority(ticketToEdit.priority || 'Médio Impacto');
                setDifficulty(ticketToEdit.difficulty || 'Médio');
                setCreationDate(ticketToEdit.creationTime ? new Date(ticketToEdit.creationTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
            } else {
                setTicketIdInput(''); 
                setSubject(''); 
                setSelectedClientId('');
                setPriority('Médio Impacto'); 
                setDifficulty('Médio');
                setCreationDate(new Date().toISOString().split('T')[0]);
            }
            setFormMessage({ text: '', type: '' }); // Reset form message each time it opens
        }
    }, [ticketToEdit, isOpen]); // Added isOpen to dependency array

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormMessage({ text: '', type: '' }); 

        if (!selectedClientId) { // Validate clientId
            setFormMessage({ text: "Seleção de cliente é obrigatória.", type: "error" });
            return;
        }
        if (!subject.trim()) {
            setFormMessage({ text: "Assunto do ticket é obrigatório.", type: "error" });
            return;
        }

        const ticketDataObject = {
            ticketIdInput: ticketIdInput.trim() || `T-${Date.now().toString().slice(-6)}`,
            subject: subject.trim(), 
            clientId: selectedClientId, // Use selectedClientId
            // accountName: accountName.trim(), // REMOVED
            priority, difficulty,
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
                if (showToast) showToast("Ticket atualizado com sucesso!", "success");
                // setFormMessage({ text: '', type: '' }); // Clear form message on success // Not needed if modal closes
            } else {
                await ticketRepository.addTicket(ticketDataObject);
                if (showToast) showToast("Ticket adicionado com sucesso!", "success");
                // setFormMessage({ text: '', type: '' }); // Clear form message on success // Not needed if modal closes
            }
            // Call the callback passed from App.jsx to refresh tickets and potentially close form
            if(onTicketAddedOrUpdated) onTicketAddedOrUpdated();
            onClose(); // Close modal on success

            // Reset form fields for next time it opens (if it's for a new ticket)
            // This is now primarily handled by useEffect based on isOpen and ticketToEdit
            if (!ticketToEdit) {
                 setTicketIdInput(''); setSubject(''); setSelectedClientId(''); 
                 setPriority('Médio Impacto'); setDifficulty('Médio');
                 setCreationDate(new Date().toISOString().split('T')[0]);
            }
        } catch (error) {
            console.error("Erro ao salvar ticket:", error);
            const errorMessage = `Erro ao salvar ticket: ${error.message || 'Erro desconhecido'}`;
            setFormMessage({ text: errorMessage, type: "error" });
            if (showToast) showToast(errorMessage, "error");
        }
    };
    
    // const handleClientInput = (e) => { // Removed
    //     setClientSearch(e.target.value);
    //     setAccountName(e.target.value);
    // };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={ticketToEdit ? 'Editar Ticket' : 'Adicionar Novo Ticket'} size="max-w-2xl">
            <form onSubmit={handleSubmit} className="p-1 bg-slate-800 rounded-lg shadow space-y-6 max-h-[80vh] overflow-y-auto no-scrollbar"> {/* Adjusted padding, no margin-bottom, scroll */}
            {/* Removed h3 title as Modal already has one */}
            {formMessage.text && <p className={`text-sm my-3 p-3 rounded-md ${formMessage.type === 'error' ? 'bg-red-500/30 text-red-200 border border-red-400/50' : 'bg-green-500/30 text-green-200 border border-green-400/50'}`}>{formMessage.text}</p>} {/* Adjusted margin */}
            
            <div className="p-4 space-y-6"> {/* Added inner padding for form elements */}
                <div>
                <label htmlFor="clientSelect" className="block text-sm font-medium text-gray-300 mb-1">Cliente *</label> {/* Added mb-1 */}
                <div className="flex items-center gap-2 mt-1"> {/* Ensure items-center for vertical alignment */}
                    <select
                        id="clientSelect"
                        value={selectedClientId}
                        onChange={e => setSelectedClientId(e.target.value)}
                        required
                        className="block w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900" /* Adjusted py for height consistency */
                    >
                        <option value="" disabled>-- Selecione um Cliente --</option>
                        {clients.map(client => (
                            <option key={client.id} value={client.id}>
                                {client.name}
                            </option>
                        ))}
                    </select>
                    <button 
                        type="button" 
                        onClick={onOpenClientModal} // Use prop to open global modal
                        className="px-3 py-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm flex items-center justify-center shadow-sm"
                        title="Cadastrar Novo Cliente"
                    >
                        <PlusCircle size={20} />
                    </button>
                </div>
            </div>

            <div><label htmlFor="ticketIdInput" className="block text-sm font-medium text-gray-300 mb-1">ID do Ticket (Opcional)</label><input type="text" id="ticketIdInput" value={ticketIdInput} onChange={(e) => setTicketIdInput(e.target.value)} disabled={!selectedClientId} className="mt-1 block w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 disabled:bg-gray-200 disabled:text-gray-500" /></div>
            <div><label htmlFor="subject" className="block text-sm font-medium text-gray-300 mb-1">Assunto *</label><input type="text" id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required disabled={!selectedClientId} className="mt-1 block w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 disabled:bg-gray-200 disabled:text-gray-500" /></div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
                <div><label htmlFor="priority" className="block text-sm font-medium text-gray-300 mb-1">Prioridade</label><select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)} disabled={!selectedClientId} className="mt-1 block w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 disabled:bg-gray-200 disabled:text-gray-500"><option value="Solicitado por Terceiros">Solicitado por Terceiros</option><option value="Alto Impacto">Alto Impacto</option><option value="Médio Impacto">Médio Impacto</option><option value="Baixo Impacto">Baixo Impacto</option></select></div>
                <div><label htmlFor="difficulty" className="block text-sm font-medium text-gray-300 mb-1">Dificuldade</label><select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} disabled={!selectedClientId} className="mt-1 block w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 disabled:bg-gray-200 disabled:text-gray-500"><option value="Fácil">Fácil</option><option value="Médio">Médio</option><option value="Difícil">Difícil</option></select></div>
            </div>
            <div><label htmlFor="creationDate" className="block text-sm font-medium text-gray-300 mb-1">Data de Criação</label><input type="date" id="creationDate" value={creationDate} onChange={(e) => setCreationDate(e.target.value)} disabled={!selectedClientId} className="mt-1 block w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 disabled:bg-gray-200 disabled:text-gray-500" /></div>
            <div className="flex justify-end space-x-3 pt-4"> {/* Submit and Cancel buttons for the modal form */}
                 <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md border border-gray-300 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center space-x-2"><Save size={18} /><span>{ticketToEdit ? 'Salvar Alterações' : 'Adicionar Ticket'}</span></button>
            </div>
            </div> {/* End of inner padding div */}
        </form>
        </Modal>
    );
};
// --- End of TicketModal (formerly TicketForm) ---

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
        <div className={`p-5 rounded-lg shadow-lg border-l-4 ${styles.bg} ${styles.border} mb-4 transition-all duration-300`}> {/* Increased p-5, shadow-lg */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className={`flex-grow mb-4 sm:mb-0 ${styles.itemText} space-y-1`}> {/* Added space-y-1 for consistent spacing */}
                    <div className="flex items-center justify-between">
                        <h4 className={`text-xl font-semibold ${styles.itemText}`}>{ticket.subject}</h4> {/* Increased subject font size */}
                        <button onClick={() => setExpanded(!expanded)} className={`p-1.5 ${styles.text} hover:text-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400`}>{expanded ? <ChevronUp size={22} /> : <ChevronDown size={22} />}</button> {/* Increased icon size and padding, added focus ring */}
                    </div>
                    <p className="text-sm text-gray-400">ID: {ticket.ticketIdInput} <span className="text-gray-500 mx-1">|</span> Cliente: {ticket.accountName || 'N/A'}</p> {/* Improved separator and color consistency */}
                    <p className="text-sm text-gray-400">Prioridade: <span className={getPriorityClass(ticket.priority)}>{ticket.priority}</span> <span className="text-gray-500 mx-1">|</span> Dificuldade: {ticket.difficulty}</p>
                    <p className="text-sm text-gray-400">Criado em: {formatDateFromISO(ticket.creationTime)}</p>
                    <p className={`text-md font-semibold ${styles.text}`}>Status: {ticket.status}</p> {/* Increased status font size and weight */}
                </div>
                <div className="flex flex-col items-stretch sm:items-end space-y-3 w-full sm:w-auto"> {/* Increased space-y, items-stretch for full width buttons on mobile */}
                    <div className="text-2xl font-mono text-indigo-300 tracking-wider flex items-center justify-end sm:justify-start"><Clock size={22} className="inline mr-2 text-indigo-400" />{formatTime(currentElapsedTime)}</div>
                    <div className="flex space-x-2 justify-end sm:justify-start w-full"> {/* Ensure buttons take available space or justify end */}
                        {ticket.status !== 'Concluído' && (
                            <button onClick={handleToggle} className={`py-2 px-3 rounded-md text-white transition-colors duration-150 flex items-center space-x-1.5 text-sm shadow-sm hover:shadow-md ${isActive && ticket.status === 'Em Progresso' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}> {/* Adjusted padding, added shadow */}
                                {isActive && ticket.status === 'Em Progresso' ? <Pause size={16} /> : <Play size={16} />}
                                <span>{isActive && ticket.status === 'Em Progresso' ? 'Pausar/Parar' : (ticket.status === 'Pausado' ? 'Retomar' : 'Iniciar')}</span>
                            </button>
                        )}
                        <button onClick={() => onEditTicket(ticket)} title="Editar Ticket" className="py-2 px-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-150 shadow-sm hover:shadow-md"><Edit3 size={16} /></button>
                        <button onClick={() => setIsConfirmDeleteOpen(true)} title="Excluir Ticket" className="py-2 px-3 bg-slate-600 text-white rounded-md hover:bg-slate-500 transition-colors duration-150 shadow-sm hover:shadow-md"><Trash2 size={16} /></button>
                    </div>
                </div>
            </div>
            {expanded && (
                <div className={`mt-4 pt-4 border-t ${styles.border} border-opacity-60 ${styles.itemText}`}> {/* Increased pt, border-opacity */}
                    <h5 className="text-md font-semibold mb-2 text-gray-200">Log de Atividades:</h5> {/* Increased font size, adjusted color */}
                    {ticket.log && ticket.log.length > 0 ? (<ul className="space-y-1.5 text-sm max-h-40 overflow-y-auto bg-slate-700/60 p-3 rounded-md shadow-inner">{ticket.log.slice().reverse().map((entry, index) => (<li key={index} className="p-1.5 rounded-sm text-gray-300 hover:bg-slate-600/50"><strong className="text-indigo-400 font-medium">{formatDateTimeFromISO(entry.timestamp)}:</strong> {entry.action}{entry.reason && <span className="text-gray-400 italic"> (Motivo: {entry.reason})</span>}{entry.checklist && (<span className="text-gray-400 text-xs block mt-0.5">(Ticket: {entry.checklist.respondeuTicket ? 'Sim' : 'Não'}, Planilha: {entry.checklist.respondeuPlanilha ? 'Sim' : 'Não'})</span>)}</li>))}</ul>) : (<p className="text-sm text-gray-400">Nenhuma atividade registrada.</p>)} {/* Increased text size, padding, max-h */}
                    <h5 className="text-md font-semibold mt-4 mb-2 text-gray-200">Checklist Atual:</h5> {/* Increased mt, font size */}
                    <ul className="text-sm space-y-1.5 text-gray-300"> {/* Increased text size, space-y */}
                        <li className="flex items-center p-1">{ticket.checklist?.respondeuTicket ? <CheckCircle size={16} className="text-green-400 mr-2"/> : <XCircle size={16} className="text-red-400 mr-2"/>}Respondeu Ticket Principal</li>
                        <li className="flex items-center p-1">{ticket.checklist?.respondeuPlanilha ? <CheckCircle size={16} className="text-green-400 mr-2"/> : <XCircle size={16} className="text-red-400 mr-2"/>}Atualizou Planilha</li>
                    </ul>
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
        // selectedDate is "YYYY-MM-DD" string from input, representing local date.

        if (reportType === 'daily') {
            const dailySummary = tickets.map(ticket => {
                let actionsOnDay = [];
                (ticket.log || []).forEach(logEntry => {
                    const logEntryDate = new Date(logEntry.timestamp); // UTC timestamp from log
                    // Format logEntryDate to "YYYY-MM-DD" in local time for comparison
                    const logYear = logEntryDate.getFullYear();
                    const logMonth = (logEntryDate.getMonth() + 1).toString().padStart(2, '0');
                    const logDay = logEntryDate.getDate().toString().padStart(2, '0');
                    const localLogDateString = `${logYear}-${logMonth}-${logDay}`;

                    if (localLogDateString === selectedDate) {
                        actionsOnDay.push(`${formatDateTimeFromISO(logEntry.timestamp)}: ${logEntry.action} ${logEntry.reason ? '('+logEntry.reason+')':''}`);
                    }
                });
                return { 
                    id: ticket.id, 
                    subject: ticket.subject, 
                    timeSpentDisplay: actionsOnDay.length > 0 ? formatTime(ticket.elapsedTime) : formatTime(0), // Note: This is total ticket time, not time on day.
                    actions: actionsOnDay, 
                };
            }).filter(t => t.actions.length > 0);
            
            // Create a Date object from selectedDate at midday local time for display formatting.
            const displayDate = new Date(selectedDate + "T12:00:00"); 
            setReportData({ type: 'daily', date: formatDateFromISO(displayDate.toISOString()), summary: dailySummary });

        } else if (reportType === 'weekly') {
            // Treat selectedDate as the target local date to determine the week.
            const targetLocalDate = new Date(selectedDate + "T12:00:00"); 
            
            const dayOfWeek = targetLocalDate.getDay(); // Sunday = 0, Monday = 1, etc. (local)
            const diffToSunday = targetLocalDate.getDate() - dayOfWeek;
            
            const weekStart = new Date(targetLocalDate);
            weekStart.setDate(diffToSunday);
            weekStart.setHours(0, 0, 0, 0); // Start of Sunday, local time

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999); // End of Saturday, local time

            const weeklySummary = tickets.filter(t => { 
                const ticketDate = new Date(t.lastUpdatedAt || t.createdAt); // Assuming these are UTC
                // Compare ticketDate (UTC) against the local time range [weekStart, weekEnd]
                // This comparison is okay as Date objects will handle the underlying epoch values.
                return ticketDate >= weekStart && ticketDate <= weekEnd; 
            }).map(ticket => ({ 
                id: ticket.id, 
                subject: ticket.subject, 
                totalTime: formatTime(ticket.elapsedTime), 
                status: ticket.status, 
            }));
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
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false); // Renamed from showTicketForm
    const [currentView, setCurrentView] = useState('tickets');
    const [editingTicket, setEditingTicket] = useState(null); 
    const [ticketFilter, setTicketFilter] = useState('abertos');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [filterDifficulty, setFilterDifficulty] = useState('');
    const [filterClient, setFilterClient] = useState('');
    const [clients, setClients] = useState([]); // This state will hold all clients
    const [isClientModalOpen, setIsClientModalOpen] = useState(false); // State for global ClientModal
    const [toast, setToast] = useState({ message: '', type: '', key: 0 }); // Toast state

    const showToast = (message, type = 'info') => {
        const newKey = Date.now();
        setToast({ message, type, key: newKey });
        setTimeout(() => {
            // Only clear the toast if it's the one we just set.
            // This prevents an older timeout from clearing a newer toast.
            setToast(prev => (prev.key === newKey ? { message: '', type: '', key: 0 } : prev));
        }, 3000); // Auto-dismiss after 3 seconds
    };

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
                    const newLogForOldTask = `Pausado automaticamente para iniciar: '${currentTicketData.subject}'`;
                    try { 
                        await ticketRepository.updateTicket(activeTicketId, { 
                            ...activeTicketRunningData, 
                            elapsedTime: (activeTicketRunningData.elapsedTime || 0) + activeSessionSeconds, 
                            isActive: false, 
                            status: 'Pausado', 
                            currentTimerStartTime: null, 
                            log: addLogEntryToTicketObject(activeTicketRunningData.log, newLogForOldTask) 
                        }); 
                    }
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
    const handleTicketAddedOrUpdated = () => { // This will be for onTicketModalSuccess
        fetchTickets();
        setIsTicketModalOpen(false); 
        setEditingTicket(null); 
    };
    const handleEditTicket = (ticket) => { 
        setEditingTicket(ticket); 
        setIsTicketModalOpen(true); // Use new state
    };
    const handleCloseTicketModal = () => { // New handler for modal's onClose
        setIsTicketModalOpen(false); 
        setEditingTicket(null); 
    };

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
        if (filterStartDate) filtered = filtered.filter(t => t.creationTime && new Date(new Date(filterStartDate).toDateString()) <= new Date(new Date(t.creationTime).toDateString()));
        if (filterEndDate) filtered = filtered.filter(t => {
            const ticketDate = new Date(t.creationTime);
            // Normalize both dates to avoid time zone issues by comparing date strings
            const ticketDateString = ticketDate.toISOString().split('T')[0];
            const filterEndDateString = new Date(filterEndDate).toISOString().split('T')[0];
            return ticketDateString <= filterEndDateString;
        });

        if (filterPriority) filtered = filtered.filter(t => t.priority === filterPriority);
        if (filterDifficulty) filtered = filtered.filter(t => t.difficulty === filterDifficulty);
        if (filterClient) { // Reverted to partial, case-insensitive match
            filtered = filtered.filter(t => t.accountName && t.accountName.toLowerCase().includes(filterClient.toLowerCase()));
        }
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
                {toast.message && <ToastMessage key={toast.key} message={toast.message} type={toast.type} onDismiss={() => setToast({ message: '', type: '', key: 0 })} />}
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
                                <button onClick={() => setShowAdvancedFilters(v => !v)} className="ml-2 px-3 py-2 text-xs rounded bg-indigo-600 hover:bg-indigo-700 text-white flex items-center space-x-1">
                                    <Filter size={14}/>
                                    <span>{showAdvancedFilters ? 'Ocultar Filtros' : 'Filtros Avançados'}</span>
                                </button>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto"> {/* Wrapper for buttons */}
                                <button 
                                    onClick={() => setIsClientModalOpen(true)} 
                                    className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out flex items-center space-x-2 w-full sm:w-auto justify-center"
                                >
                                    <UserPlus size={20} />
                                    <span>Cadastrar Cliente</span>
                                </button>
                                <button 
                                    onClick={() => { 
                                        setEditingTicket(null); 
                                        setIsTicketModalOpen(true); // Open modal for new ticket
                                    }} 
                                    className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out flex items-center space-x-2 w-full sm:w-auto justify-center"
                                >
                                    <PlusCircle size={20} />
                                    <span>Adicionar Ticket</span> {/* Static text */}
                                </button>
                            </div>
                        </div>
                        {showAdvancedFilters && (
                            <div className="mb-6 bg-slate-800 p-4 rounded-lg shadow">
                                <h4 className="text-lg font-semibold text-gray-100 mb-3">Filtros Avançados</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
                                    <div>
                                        <label htmlFor="filterStartDate" className="block text-xs font-medium text-gray-300 mb-1">Data Inicial</label>
                                        <input type="date" id="filterStartDate" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="w-full bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm" />
                                    </div>
                                    <div>
                                        <label htmlFor="filterEndDate" className="block text-xs font-medium text-gray-300 mb-1">Data Final</label>
                                        <input type="date" id="filterEndDate" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="w-full bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm" />
                                    </div>
                                    <div>
                                        <label htmlFor="filterPriority" className="block text-xs font-medium text-gray-300 mb-1">Prioridade</label>
                                        <select id="filterPriority" value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="w-full bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm">
                                            <option value="">Todas</option>
                                            <option value="Solicitado por Terceiros">Solicitado por Terceiros</option>
                                            <option value="Alto Impacto">Alto Impacto</option>
                                            <option value="Médio Impacto">Médio Impacto</option>
                                            <option value="Baixo Impacto">Baixo Impacto</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="filterDifficulty" className="block text-xs font-medium text-gray-300 mb-1">Dificuldade</label>
                                        <select id="filterDifficulty" value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)} className="w-full bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm">
                                            <option value="">Todas</option>
                                            <option value="Fácil">Fácil</option>
                                            <option value="Médio">Médio</option>
                                            <option value="Difícil">Difícil</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="filterClientInput" className="block text-xs font-medium text-gray-300 mb-1">Cliente</label>
                                        <input
                                            type="text"
                                            id="filterClientInput"
                                            value={filterClient}
                                            onChange={e => setFilterClient(e.target.value)}
                                            placeholder="Digite para buscar cliente..."
                                            className="w-full bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm"
                                            list="advanced-client-filter-list"
                                            autoComplete="off"
                                        />
                                        <datalist id="advanced-client-filter-list">
                                            {clients
                                                .filter(client => 
                                                    filterClient.trim() === '' || 
                                                    client.name.toLowerCase().includes(filterClient.toLowerCase())
                                                )
                                                .map(client => (
                                                    <option key={client.id} value={client.name} />
                                                ))
                                            }
                                        </datalist>
                                    </div>
                                    <div className="self-end">
                                        <button 
                                            onClick={() => { setFilterStartDate(''); setFilterEndDate(''); setFilterPriority(''); setFilterDifficulty(''); setFilterClient(''); }} 
                                            className="w-full px-3 py-2 text-sm rounded bg-slate-600 hover:bg-slate-500 text-white" // Adjusted padding and text size
                                        >
                                            Limpar Filtros
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* Conditional rendering of TicketModal removed from here */}
                        {isLoading && <div className="text-center py-10 text-gray-300">Carregando tickets...</div>}
                        {!isLoading && !error && filteredTickets.length === 0 && !isTicketModalOpen && (<div className="text-center py-10 bg-slate-800 rounded-lg shadow-md"><p className="text-xl text-gray-400">Nenhum ticket encontrado para o filtro atual.</p>{ticketFilter === 'abertos' && <p className="text-gray-500">Adicione um novo ticket para começar ou altere o filtro.</p>}</div>)}
                        {!isLoading && !error && filteredTickets.length > 0 && (<div className="space-y-4">{filteredTickets.map(ticket => (<TicketItem key={ticket.id} ticket={ticket} onToggleTimer={handleToggleTimer} onDeleteTicket={handleDeleteTicket} onEditTicket={handleEditTicket} activeTicketId={activeTicketId}/>))}</div>)}
                    </>)}
                    {currentView === 'reports' && (<ReportsView tickets={tickets} />)}
                </main>
                <TicketModal
                    isOpen={isTicketModalOpen}
                    onClose={handleCloseTicketModal}
                    ticketToEdit={editingTicket}
                    onTicketAddedOrUpdated={handleTicketAddedOrUpdated} // Renamed from handleTicketModalSuccess for clarity
                    clients={clients}
                    showToast={showToast}
                    onOpenClientModal={() => setIsClientModalOpen(true)}
                />
                <ClientModal 
                    isOpen={isClientModalOpen} 
                    onClose={() => setIsClientModalOpen(false)} 
                    onClientAdded={() => { 
                        fetchClients().then(newClients => {
                            setClients(newClients); 
                        });
                        setIsClientModalOpen(false); 
                        showToast("Cliente cadastrado com sucesso!", "success");
                    }} 
                />
                <footer className="text-center py-6 text-sm text-gray-500 border-t border-slate-700 mt-10"><p>&copy; {new Date().getFullYear()} Gerenciador de Tempo Local.</p></footer>
            </div>
        </TicketRepositoryContext.Provider>
    );
}

export default App;