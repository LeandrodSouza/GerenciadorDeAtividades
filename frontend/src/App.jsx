import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { Clock, Play, Pause, PlusCircle, UserPlus, CalendarDays, Trash2, Edit3, ListChecks, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Save, Filter, FileText, BarChart3, RefreshCw, LayoutDashboard, Users } from 'lucide-react'; // Added Users
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

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
    try {
        return new Date(isoString).toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
        });
    } catch (e) {
        console.error("Erro ao formatar data:", isoString, e);
        return 'Data inválida';
    }
};

const formatDateTimeFromISO = (isoString) => {
    if (!isoString) return 'N/A';
    try {
        return new Date(isoString).toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } catch (e) {
        console.error("Erro ao formatar data/hora:", isoString, e);
        return 'Data/Hora inválida';
    }
};

const getPriorityClass = (priority) => {
    if (priority === 'Solicitado por Terceiros') return 'text-purple-400 font-bold';
    if (priority === 'Alto Impacto') return 'text-red-400';
    if (priority === 'Médio Impacto') return 'text-yellow-400';
    return 'text-blue-400';
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

// EditClientModal Component
function EditClientModal({ isOpen, onClose, client, onClientUpdated, showToast }) {
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName(client ? client.name || '' : '');
            setError('');
            // setLoading(false); // Reset loading only if it was stuck, typically managed by submit
        } else {
            // Reset fields when modal is closed, ensures clean state for next open
            setName('');
            setError('');
            setLoading(false);
        }
    }, [isOpen, client]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); // Clear previous errors

        if (!name.trim()) {
            setError('Nome é obrigatório');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/clients/${client.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim().toUpperCase() }),
            });

            if (!res.ok) {
                const data = await res.json();
                const apiError = data.error || 'Erro ao atualizar cliente';
                setError(apiError); // Show error in modal
                if (showToast) showToast(apiError, "error"); // Show error toast
                setLoading(false);
                return;
            }

            if (showToast) showToast("Cliente atualizado com sucesso!", "success");
            if (onClientUpdated) onClientUpdated();
            onClose(); // Close modal on success
        } catch (err) {
            const catchError = 'Falha na comunicação com o servidor ao atualizar cliente.';
            setError(catchError);
             if (showToast) showToast(catchError, "error");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Cliente">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="clientNameEdit" className="block text-sm font-medium text-gray-700 mb-1">Nome do Cliente *</label>
                    <input
                        type="text"
                        id="clientNameEdit"
                        value={name}
                        onChange={e => setName(e.target.value)} // Uppercase conversion happens on submit
                        placeholder="Nome do Cliente"
                        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900"
                    />
                </div>
                {error && <div className="text-red-600 text-sm p-2 bg-red-100 rounded-md">{error}</div>}
                <div className="flex justify-end space-x-3 pt-2">
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
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

const ClientManagementView = () => {
    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
    const [deletingClientId, setDeletingClientId] = useState(null);


    const fetchAndSetClients = useCallback(async () => {
        setIsLoading(true);
        try {
            const clientData = await fetchClients(); // fetchClients is globally defined
            setClients(clientData);
            setError(null);
        } catch (err) {
            console.error("Erro ao buscar clientes:", err);
            setError("Falha ao carregar clientes.");
            setClients([]);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchAndSetClients();
    }, [fetchAndSetClients]);

    // This showToast is local to ClientManagementView and will be passed to EditClientModal
    const showToast = useCallback((message, type) => {
        // This is a placeholder. In the main App component, a real showToast is defined.
        // For ClientManagementView, if it's used standalone or needs its own,
        // it should call the global one or have its own ToastMessage rendering.
        // For now, we assume it's passed from App or App.showToast is globally accessible.
        // The prompt implies App.showToast is used.
        // Let's find where showToast is *actually* defined for the App component.
        // It's defined in `App` component and passed down.
        // So, ClientManagementView should ideally receive `showToast` as a prop if it's not App itself.
        // However, the current structure has ClientManagementView defining its own `showToast`.
        // We'll keep this local definition and pass it to EditClientModal.
        // The main App's showToast will be used by other parts of the application.
        // console.log(`ClientManagementView Toast: ${message} (${type})`);
        // For the purpose of this subtask, we assume this showToast is connected to a real toast mechanism.
        // If `ClientManagementView` is rendered by `App`, `App`'s `showToast` should be passed.
        // Let's assume `ClientManagementView` receives `showToast` from `App` or uses a context.
        // For the sake of this exercise, we'll use this local one and pass it.
        // The provided App.jsx has showToast in the main App scope.
        // ClientManagementView doesn't receive it as a prop in the current code.
        // It *defines* its own. This is what will be passed to EditClientModal.

        // Re-checking the prompt: "The showToast function used in ClientManagementView should be passed as a prop to EditClientModal."
        // "The ClientManagementView already has a showToast function defined, this is the one to pass to EditClientModal."
        // This confirms the local showToast is the one to use.
        // To make it actually display, it should be connected to the ToastMessage component.
        // For now, it's a console log as per the original placeholder.
        // Let's ensure it's at least available and passed.
        // The main `App`'s `showToast` is what `ClientModal` (for add) uses via `onClientAdded` indirectly.
        // This `showToast` will be used by `EditClientModal` directly.
         // This is a placeholder. A real app would have a global toast system.
        // For now, using console.log to simulate.
        // The main App component actually has a working showToast.
        // This component is nested. It should ideally receive showToast from App.
        // For this exercise, we'll just use the one defined here as per the prompt.
        const appShowToast = window.globalShowToast; // Accessing the global one for actual display
        if (appShowToast) {
            appShowToast(message, type);
        } else {
            console.warn("ClientManagementView: showToast function not fully connected to UI. Message:", message, "Type:", type);
        }
    }, []);


    const handleClientAdded = () => {
        fetchAndSetClients();
        showToast("Cliente adicionado com sucesso!", "success");
    };

    const handleEditClient = (client) => {
        setEditingClient(client);
        setIsEditModalOpen(true);
    };

    const handleClientUpdated = () => {
        fetchAndSetClients();
        setIsEditModalOpen(false);
        // Success toast is shown by EditClientModal itself
    };

    const handleDeleteClient = (clientId) => {
        setDeletingClientId(clientId);
        setIsConfirmDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!deletingClientId) {
            console.error("No client ID specified for deletion.");
            showToast("ID do cliente não especificado para exclusão.", "error");
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/clients/${deletingClientId}`, { method: 'DELETE' });
            if (!response.ok) {
                let errorMsg = `Erro ao excluir cliente. Status: ${response.status}`;
                try {
                    const data = await response.json();
                    errorMsg = data.error || errorMsg;
                } catch (e) { /* Ignore if response is not JSON */ }
                throw new Error(errorMsg);
            }
            fetchAndSetClients(); // Refresh list
            showToast("Cliente excluído com sucesso!", "success");
        } catch (err) {
            showToast(err.message || "Falha ao excluir cliente.", "error");
        } finally {
            setIsConfirmDeleteModalOpen(false);
            setDeletingClientId(null);
        }
    };


    return (
        <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-100">Gerenciamento de Clientes</h2>
                <button
                    onClick={() => setIsClientModalOpen(true)}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out flex items-center space-x-2"
                >
                    <UserPlus size={20} />
                    <span>Novo Cliente</span>
                </button>
            </div>

            {isLoading && <p className="text-gray-300 text-center py-4">Carregando clientes...</p>}
            {error && <p className="text-red-400 bg-red-900/30 p-3 rounded-md text-center">{error}</p>}

            {!isLoading && !error && clients.length === 0 && (
                <p className="text-gray-400 text-center py-4">Nenhum cliente cadastrado.</p>
            )}

            {!isLoading && !error && clients.length > 0 && (
                <div className="overflow-x-auto rounded-lg shadow">
                    <table className="min-w-full bg-slate-700 text-gray-200">
                        <thead className="bg-slate-600">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Nome</th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">ID</th>
                                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-600">
                            {clients.map(client => (
                                <tr key={client.id} className="hover:bg-slate-600/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{client.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{client.id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right space-x-2">
                                        <button onClick={() => handleEditClient(client)} className="text-indigo-400 hover:text-indigo-300" title="Editar Cliente">
                                            <Edit3 size={18} />
                                        </button>
                                        <button onClick={() => handleDeleteClient(client.id)} className="text-red-400 hover:text-red-300" title="Excluir Cliente">
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
             {/* ClientModal for adding new clients */}
             <ClientModal
                isOpen={isClientModalOpen}
                onClose={() => setIsClientModalOpen(false)}
                onClientAdded={handleClientAdded}
            />
            {/* Edit Client Modal */}
            <EditClientModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                client={editingClient}
                onClientUpdated={handleClientUpdated}
                showToast={showToast} // Pass the local showToast function
            />
            {/* Confirmation Modal for Deletion */}
            <ConfirmationModal
                isOpen={isConfirmDeleteModalOpen}
                onClose={() => {
                    setIsConfirmDeleteModalOpen(false);
                    setDeletingClientId(null);
                }}
                onConfirm={handleConfirmDelete}
                title="Confirmar Exclusão de Cliente"
                message={
                    deletingClientId && clients.find(c => c.id === deletingClientId)
                        ? `Tem certeza que deseja excluir o cliente "${clients.find(c => c.id === deletingClientId).name}"? Esta ação não pode ser desfeita.`
                        : "Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
                }
            />
        </div>
    );
};

const KANBAN_COLUMNS = [
    { id: 'Pendente', title: 'Pendente (Backlog)', status: 'Pendente' },
    { id: 'EmProgresso', title: 'Em Progresso', status: 'Em Progresso' },
    { id: 'EmEspera', title: 'Em Espera', status: 'Em Espera' },
    { id: 'Concluido', title: 'Concluído', status: 'Concluído' }
];

const ToastMessage = ({ message, type, onDismiss }) => {
    if (!message) return null;
    const baseStyle = "fixed top-5 right-5 p-4 rounded-lg shadow-xl text-white transition-all duration-500 ease-in-out opacity-0 animate-fadeInOut";
    const typeStyles = { success: "bg-green-500", error: "bg-red-500", info: "bg-blue-500" };
    const animationStyle = `@keyframes fadeInOutAnimation { 0% { opacity: 0; transform: translateY(-20px); } 10% { opacity: 1; transform: translateY(0); } 90% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-20px); } } .animate-fadeInOut { animation: fadeInOutAnimation 3s forwards; }`;
    return (
        <>
            <style>{animationStyle}</style>
            <div className={`${baseStyle} ${typeStyles[type] || typeStyles.info} z-[100]`}>
                <span>{message}</span>
                <button onClick={onDismiss} className="ml-4 text-xl font-semibold leading-none hover:text-gray-200 focus:outline-none" aria-label="Dismiss message">&times;</button>
            </div>
        </>
    );
};

async function fetchClients() {
    const res = await fetch(`${API_BASE_URL}/clients`);
    const data = await res.json();
    return data.data || [];
}

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
            if (!res.ok) { const data = await res.json(); setError(data.error || 'Erro ao cadastrar cliente'); setLoading(false); return; }
            setName(''); setLoading(false); onClientAdded && onClientAdded(); onClose();
        } catch (err) { setError('Erro ao cadastrar cliente'); setLoading(false); }
    };
    useEffect(() => { if (!isOpen) { setName(''); setError(''); setLoading(false); } }, [isOpen]);
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Cadastrar Cliente">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-1">Nome do Cliente *</label>
                    <input type="text" id="clientName" value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="Nome do Cliente" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900" />
                </div>
                {error && <div className="text-red-600 text-sm p-2 bg-red-100 rounded-md">{error}</div>}
                <div className="flex justify-end space-x-3 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md border border-gray-300 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" disabled={loading}>Cancelar</button>
                    <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center" disabled={loading}>
                        {loading ? (<svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>) : <Save size={18} className="mr-2"/>}
                        {loading ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

const TicketModal = ({ isOpen, onClose, ticketToEdit, onTicketAddedOrUpdated, clients, showToast, onOpenClientModal }) => {
    const ticketRepository = useTicketRepository();
    const [ticketIdInput, setTicketIdInput] = useState('');
    const [subject, setSubject] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [priority, setPriority] = useState('Médio Impacto');
    const [difficulty, setDifficulty] = useState('Médio');
    const [creationDate, setCreationDate] = useState(new Date().toISOString().split('T')[0]);
    const [formMessage, setFormMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        if (isOpen) {
            if (ticketToEdit) {
                setTicketIdInput(ticketToEdit.ticketIdInput || ''); setSubject(ticketToEdit.subject || ''); setSelectedClientId(ticketToEdit.clientId || '');
                setPriority(ticketToEdit.priority || 'Médio Impacto'); setDifficulty(ticketToEdit.difficulty || 'Médio');
                setCreationDate(ticketToEdit.creationTime ? new Date(ticketToEdit.creationTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
            } else {
                setTicketIdInput(''); setSubject(''); setSelectedClientId(''); setPriority('Médio Impacto'); setDifficulty('Médio');
                setCreationDate(new Date().toISOString().split('T')[0]);
            }
            setFormMessage({ text: '', type: '' });
        }
    }, [ticketToEdit, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault(); setFormMessage({ text: '', type: '' });
        if (!selectedClientId) { setFormMessage({ text: "Seleção de cliente é obrigatória.", type: "error" }); return; }
        if (!subject.trim()) { setFormMessage({ text: "Assunto do ticket é obrigatório.", type: "error" }); return; }
        const ticketDataObject = {
            ticketIdInput: ticketIdInput.trim() || `T-${Date.now().toString().slice(-6)}`, subject: subject.trim(), clientId: selectedClientId, priority, difficulty,
            creationTime: new Date(creationDate + "T00:00:00.000Z").toISOString(), status: ticketToEdit ? ticketToEdit.status : 'Pendente',
            elapsedTime: ticketToEdit ? ticketToEdit.elapsedTime || 0 : 0, isActive: ticketToEdit ? ticketToEdit.isActive || false : false,
            log: ticketToEdit ? ticketToEdit.log || [] : [], checklist: ticketToEdit ? ticketToEdit.checklist || { respondeuTicket: false, respondeuPlanilha: false } : { respondeuTicket: false, respondeuPlanilha: false },
            currentTimerStartTime: ticketToEdit ? ticketToEdit.currentTimerStartTime : null, ...(ticketToEdit && ticketToEdit.createdAt && {createdAt: ticketToEdit.createdAt})
        };
        try {
            if (ticketToEdit) { await ticketRepository.updateTicket(ticketToEdit.id, ticketDataObject); if (showToast) showToast("Ticket atualizado com sucesso!", "success"); }
            else { await ticketRepository.addTicket(ticketDataObject); if (showToast) showToast("Ticket adicionado com sucesso!", "success"); }
            if(onTicketAddedOrUpdated) onTicketAddedOrUpdated(); onClose();
            if (!ticketToEdit) { setTicketIdInput(''); setSubject(''); setSelectedClientId(''); setPriority('Médio Impacto'); setDifficulty('Médio'); setCreationDate(new Date().toISOString().split('T')[0]); }
        } catch (error) {
            console.error("Erro ao salvar ticket:", error); const errorMessage = `Erro ao salvar ticket: ${error.message || 'Erro desconhecido'}`;
            setFormMessage({ text: errorMessage, type: "error" }); if (showToast) showToast(errorMessage, "error");
        }
    };
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={ticketToEdit ? 'Editar Ticket' : 'Adicionar Novo Ticket'} size="max-w-2xl">
            <form onSubmit={handleSubmit} className="p-1 bg-slate-800 rounded-lg shadow space-y-6 max-h-[80vh] overflow-y-auto no-scrollbar">
            {formMessage.text && <p className={`text-sm my-3 p-3 rounded-md ${formMessage.type === 'error' ? 'bg-red-500/30 text-red-200 border border-red-400/50' : 'bg-green-500/30 text-green-200 border border-green-400/50'}`}>{formMessage.text}</p>}
            <div className="p-4 space-y-6">
                <div>
                <label htmlFor="clientSelect" className="block text-sm font-medium text-gray-300 mb-1">Cliente *</label>
                <div className="flex items-center gap-2 mt-1">
                    <select id="clientSelect" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} required className="block w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900">
                        <option value="" disabled>-- Selecione um Cliente --</option>
                        {clients.map(client => (<option key={client.id} value={client.id}>{client.name}</option>))}
                    </select>
                    <button type="button" onClick={onOpenClientModal} className="px-3 py-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm flex items-center justify-center shadow-sm" title="Cadastrar Novo Cliente"><PlusCircle size={20} /></button>
                </div>
            </div>
            <div><label htmlFor="ticketIdInput" className="block text-sm font-medium text-gray-300 mb-1">ID do Ticket (Opcional)</label><input type="text" id="ticketIdInput" value={ticketIdInput} onChange={(e) => setTicketIdInput(e.target.value)} disabled={!selectedClientId} className="mt-1 block w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 disabled:bg-gray-200 disabled:text-gray-500" /></div>
            <div><label htmlFor="subject" className="block text-sm font-medium text-gray-300 mb-1">Assunto *</label><input type="text" id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required disabled={!selectedClientId} className="mt-1 block w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 disabled:bg-gray-200 disabled:text-gray-500" /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
                <div><label htmlFor="priority" className="block text-sm font-medium text-gray-300 mb-1">Prioridade</label><select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)} disabled={!selectedClientId} className="mt-1 block w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 disabled:bg-gray-200 disabled:text-gray-500"><option value="Solicitado por Terceiros">Solicitado por Terceiros</option><option value="Alto Impacto">Alto Impacto</option><option value="Médio Impacto">Médio Impacto</option><option value="Baixo Impacto">Baixo Impacto</option></select></div>
                <div><label htmlFor="difficulty" className="block text-sm font-medium text-gray-300 mb-1">Dificuldade</label><select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} disabled={!selectedClientId} className="mt-1 block w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 disabled:bg-gray-200 disabled:text-gray-500"><option value="Fácil">Fácil</option><option value="Médio">Médio</option><option value="Difícil">Difícil</option></select></div>
            </div>
            <div><label htmlFor="creationDate" className="block text-sm font-medium text-gray-300 mb-1">Data de Criação</label><input type="date" id="creationDate" value={creationDate} onChange={(e) => setCreationDate(e.target.value)} disabled={!selectedClientId} className="mt-1 block w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 disabled:bg-gray-200 disabled:text-gray-500" /></div>
            <div className="flex justify-end space-x-3 pt-4">
                 <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md border border-gray-300 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center space-x-2"><Save size={18} /><span>{ticketToEdit ? 'Salvar Alterações' : 'Adicionar Ticket'}</span></button>
            </div>
            </div>
        </form>
        </Modal>
    );
};

const KanbanCard = ({ ticket, index, onEditTicket, onDeleteTicket, onToggleTimer, activeTicketId, getPriorityClass, formatTime, formatDateTimeFromISO, StopTimerModalComponent, ConfirmationModalComponent }) => {
    const [currentElapsedTime, setCurrentElapsedTime] = useState(ticket.elapsedTime || 0);
    const [timerIntervalId, setTimerIntervalId] = useState(null);
    const isActive = ticket.id === activeTicketId;

    useEffect(() => {
        setCurrentElapsedTime(ticket.elapsedTime || 0);
        let intervalId = timerIntervalId;
        if (isActive && ticket.status === 'Em Progresso' && ticket.currentTimerStartTime) {
            const startTime = new Date(ticket.currentTimerStartTime).getTime();
            const updateTimer = () => {
                const now = Date.now();
                const sessionSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
                setCurrentElapsedTime((ticket.elapsedTime || 0) + sessionSeconds);
            };
            updateTimer();
            intervalId = setInterval(updateTimer, 1000);
            setTimerIntervalId(intervalId);
        } else if (intervalId) {
            clearInterval(intervalId);
            setTimerIntervalId(null);
        }
        return () => { if (intervalId) clearInterval(intervalId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive, ticket.status, ticket.currentTimerStartTime, ticket.elapsedTime]);

    const [isStopModalOpen, setIsStopModalOpen] = useState(false);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

    const handleToggle = () => {
        if (isActive && ticket.status === 'Em Progresso') { setIsStopModalOpen(true); }
        else { if (ticket.status !== 'Concluído') { onToggleTimer(ticket.id, ticket.status); } }
    };
    const handleStopConfirm = async (reason, checklist, isCompleting) => {
        await onToggleTimer(ticket.id, ticket.status, reason, checklist, isCompleting);
        setIsStopModalOpen(false);
    };
    const cardBorderColor = isActive && ticket.status === 'Em Progresso' ? 'border-green-400' : ticket.status === 'Em Espera' ? 'border-yellow-400' : ticket.status === 'Pendente' ? 'border-sky-400' : 'border-slate-600';

    return (
        <Draggable draggableId={String(ticket.id)} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`bg-slate-800/80 p-3 rounded-lg shadow-lg hover:shadow-indigo-500/40 transition-all duration-200 ease-in-out border-l-4 ${cardBorderColor} space-y-1.5 ${snapshot.isDragging ? 'shadow-2xl scale-105' : 'shadow-lg'} transition-transform duration-200`}
                >
                    <h4 className="font-semibold text-gray-50 text-base leading-tight truncate" title={ticket.subject}>{ticket.subject}</h4>
                    <p className="text-xs text-gray-400 truncate" title={ticket.accountName || 'N/A'}>Cliente: {ticket.accountName || 'N/A'}</p>
                    <p className={`text-xs truncate font-medium ${getPriorityClass(ticket.priority)}`}>Prioridade: {ticket.priority}</p>
                    <p className="text-xs text-gray-500">Criado: {formatDateFromISO(ticket.createdAt)}</p>
                    <div className="flex justify-between items-center pt-1.5">
                        <div className={`text-base font-mono tracking-tight flex items-center ${isActive && ticket.status === 'Em Progresso' ? 'text-green-300 animate-pulse' : 'text-indigo-300'}`}>
                            <Clock size={15} className="inline mr-1.5" />{formatTime(currentElapsedTime)}
                        </div>
                        {ticket.status !== 'Concluído' && (
                            <button onClick={handleToggle} title={isActive && ticket.status === 'Em Progresso' ? 'Pausar/Completar Tarefa' : (ticket.status === 'Em Espera' ? 'Retomar Tarefa' : 'Iniciar Tarefa')}
                                className={`p-2 rounded-md text-white shadow-md hover:shadow-lg transition-all duration-150 ${isActive && ticket.status === 'Em Progresso' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                                {isActive && ticket.status === 'Em Progresso' ? <Pause size={16} /> : <Play size={16} />}
                            </button>
                        )}
                   </div>
                   <div className="flex justify-end space-x-2 mt-2 pt-2 border-t border-slate-700">
                       <button onClick={() => onEditTicket(ticket)} title="Editar Ticket" className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"><Edit3 size={14} /></button>
                       <button onClick={() => setIsConfirmDeleteOpen(true)} title="Excluir Ticket" className="p-2 bg-slate-600/80 text-white rounded-md hover:bg-slate-500 transition-colors shadow-sm hover:shadow-md"><Trash2 size={14} /></button>
                   </div>
                    {isStopModalOpen && StopTimerModalComponent && <StopTimerModalComponent isOpen={isStopModalOpen} onClose={() => setIsStopModalOpen(false)} onStopConfirm={handleStopConfirm} ticket={ticket} />}
                    {isConfirmDeleteOpen && ConfirmationModalComponent && <ConfirmationModalComponent isOpen={isConfirmDeleteOpen} onClose={() => setIsConfirmDeleteOpen(false)} onConfirm={() => { onDeleteTicket(ticket.id); setIsConfirmDeleteOpen(false); }} title="Confirmar Exclusão" message={`Tem certeza que deseja excluir o ticket "${ticket.subject}"?`} />}
                </div>
            )}
        </Draggable>
    );
};

const KanbanColumn = ({ column, ticketsInColumn, onEditTicket, onDeleteTicket, onToggleTimer, activeTicketId, getPriorityClass, formatTime, formatDateTimeFromISO, StopTimerModalComponent, ConfirmationModalComponent, onOpenTicketModal }) => {
    return (
        <div className="bg-slate-700/60 p-4 rounded-xl shadow-2xl flex flex-col flex-1 min-w-[330px]">
            <h3 className="text-xl font-bold text-gray-100 mb-5 px-2 pt-1 border-b-2 border-slate-500/80 pb-3 tracking-wide flex justify-between items-center">
                <span className="flex items-center">
                    {column.title}
                    {column.id === 'Pendente' && (
                        <button
                            onClick={onOpenTicketModal}
                            className="ml-2 p-1 text-indigo-300 hover:text-indigo-100 rounded-full hover:bg-indigo-600 transition-colors"
                            title="Adicionar Novo Ticket"
                        >
                            <PlusCircle size={22} />
                        </button>
                    )}
                </span>
                <span className="text-base font-semibold bg-slate-500/70 px-3 py-1 rounded-full text-gray-50 shadow-sm">{ticketsInColumn.length}</span>
            </h3>
            <Droppable droppableId={String(column.status)} type="TICKET">
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-1.5 overflow-y-auto flex-grow max-h-[calc(100vh-320px)] p-2 scrollbar-thin scrollbar-thumb-slate-500/60 scrollbar-track-slate-800/60 scrollbar-thumb-rounded-md ${snapshot.isDraggingOver ? 'bg-slate-600/50' : ''} transition-colors duration-200`}
                    >
                        {ticketsInColumn.map((ticket, index) => (
                            <KanbanCard
                                key={ticket.id}
                                ticket={ticket}
                                index={index}
                                onEditTicket={onEditTicket}
                                onDeleteTicket={onDeleteTicket}
                                onToggleTimer={onToggleTimer}
                                activeTicketId={activeTicketId}
                                getPriorityClass={getPriorityClass}
                                formatTime={formatTime}
                                formatDateTimeFromISO={formatDateTimeFromISO}
                                StopTimerModalComponent={TicketActionModal} // Corrected: KanbanCard uses TicketActionModal via prop
                                ConfirmationModalComponent={ConfirmationModal}
                            />
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
            {ticketsInColumn.length === 0 && (
                    <div className="flex items-center justify-center h-40 border-2 border-dashed border-slate-600/80 rounded-lg mt-2 p-2">
                        <p className="text-md text-slate-500 italic">Nenhum ticket aqui.</p>
                    </div>
                )}
        </div>
    );
};

const KanbanView = ({ columns, groupedTickets, onEditTicket, onDeleteTicket, onToggleTimer, activeTicketId, getPriorityClass, formatTime, formatDateTimeFromISO, onDragEnd, onOpenTicketModal }) => {
    if (!columns || !groupedTickets) {
        return <div className="text-center p-10 text-gray-400 text-lg">Carregando quadro Kanban...</div>;
    }
    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="p-4 sm:p-5 bg-slate-800/80 rounded-xl shadow-2xl min-h-[calc(100vh-180px)]">
                <h2 className="text-3xl font-bold mb-8 text-gray-50 tracking-wider">Quadro Kanban</h2>
                <div className="flex space-x-5 overflow-x-auto pb-5 min-w-full scrollbar-thin scrollbar-thumb-slate-600/80 scrollbar-track-slate-700/50 scrollbar-thumb-rounded-md">
                    {columns.map(columnDef => (
                        <KanbanColumn
                            key={columnDef.id}
                            column={columnDef}
                            ticketsInColumn={groupedTickets[columnDef.status] || []}
                            onEditTicket={onEditTicket}
                            onDeleteTicket={onDeleteTicket}
                            onToggleTimer={onToggleTimer}
                            activeTicketId={activeTicketId}
                            getPriorityClass={getPriorityClass}
                            formatTime={formatTime}
                            formatDateTimeFromISO={formatDateTimeFromISO}
                            onOpenTicketModal={onOpenTicketModal} // Pass down the function
                        />
                    ))}
                </div>
            </div>
        </DragDropContext>
    );
};

// Consolidated Modal for status changes, reason, and checklist
// Previously StopTimerModal, now GenericTicketActionModal or similar
const TicketActionModal = ({ isOpen, onClose, onConfirm, ticket, targetStatus }) => {
    const [reason, setReason] = useState('');
    const [respondeuTicket, setRespondeuTicket] = useState(false);
    const [respondeuPlanilha, setRespondeuPlanilha] = useState(false);
    const [modalMessage, setModalMessage] = useState('');

    const isTargetStatusEspera = targetStatus === 'Em Espera';
    const isTargetStatusConcluido = targetStatus === 'Concluído';

    useEffect(() => {
        if (isOpen && ticket) {
            setRespondeuTicket(ticket.checklist?.respondeuTicket || false);
            setRespondeuPlanilha(ticket.checklist?.respondeuPlanilha || false);
            setReason(''); // Reset reason, might be pre-filled if needed in future
            setModalMessage('');
        }
    }, [isOpen, ticket, targetStatus]);

    const handleConfirmClick = () => {
        setModalMessage('');
        if (isTargetStatusEspera && !reason.trim()) {
            setModalMessage("O motivo para 'Em Espera' é obrigatório.");
            return;
        }
        if (isTargetStatusConcluido && (!respondeuTicket || !respondeuPlanilha)) {
            setModalMessage("Confirme o checklist para 'Concluído'.");
            return;
        }
        // Pass back all relevant data from the modal
        onConfirm(reason, { respondeuTicket, respondeuPlanilha });
        onClose(); // Close modal after attempting confirm
    };

    if (!isOpen || !ticket) return null;

    let modalTitle = `Alterar Status: ${ticket.subject}`;
    if (isTargetStatusEspera) modalTitle = `Colocar em Espera: ${ticket.subject}`;
    if (isTargetStatusConcluido) modalTitle = `Completar Ticket: ${ticket.subject}`;
    if (targetStatus === 'Pendente' && ticket.status === 'Concluído') modalTitle = `Reabrir Ticket: ${ticket.subject}`;
    else if (targetStatus === 'Pendente') modalTitle = `Mover para Pendente: ${ticket.subject}`;


    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
            <div className="space-y-4">
                {modalMessage && <p className="text-red-500 text-sm mb-2 p-2 bg-red-100 rounded">{modalMessage}</p>}

                {(isTargetStatusEspera || (targetStatus === 'Pendente' && ticket.status !== 'Concluído')) && (
                    <div>
                        <label htmlFor="actionReason" className="block text-sm font-medium text-gray-700">
                            Motivo {isTargetStatusEspera ? '*' : '(Opcional)'}
                        </label>
                        <textarea
                            id="actionReason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows="3"
                            required={isTargetStatusEspera}
                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900"
                            placeholder={isTargetStatusEspera ? "Ex: Aguardando resposta do cliente..." : "Motivo para mover para pendente..."}
                        />
                    </div>
                )}

                {isTargetStatusConcluido && (
                    <div className="space-y-2 pt-2">
                        <p className="text-sm font-medium text-gray-700">Checklist de Finalização *</p>
                        <label className="flex items-center space-x-2 text-sm text-gray-600">
                            <input type="checkbox" checked={respondeuTicket} onChange={(e) => setRespondeuTicket(e.target.checked)} className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
                            <span>Respondeu o ticket na plataforma principal?</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm text-gray-600">
                            <input type="checkbox" checked={respondeuPlanilha} onChange={(e) => setRespondeuPlanilha(e.target.checked)} className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
                            <span>Atualizou a planilha de controle?</span>
                        </label>
                    </div>
                )}
                 {/* Special case for reopening a completed ticket to backlog */}
                 {targetStatus === 'Pendente' && ticket.status === 'Concluído' && !isTargetStatusEspera && (
                     <div>
                        <label htmlFor="actionReasonReopen" className="block text-sm font-medium text-gray-700">
                            Motivo para Reabrir (Opcional)
                        </label>
                        <textarea
                            id="actionReasonReopen"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows="3"
                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900"
                            placeholder="Ex: Cliente solicitou reabertura, Tarefa não foi completamente resolvida..."
                        />
                    </div>
                 )}


                <div className="flex justify-end space-x-3 pt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">Cancelar</button>
                    <button onClick={handleConfirmClick} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Confirmar</button>
                </div>
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
            updateTimer();
            const intervalId = setInterval(updateTimer, 1000);
            setTimerIntervalId(intervalId);
            return () => clearInterval(intervalId);
        } else if (timerIntervalId) {
            clearInterval(timerIntervalId);
            setTimerIntervalId(null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive, ticket.status, ticket.currentTimerStartTime, ticket.elapsedTime]);

    const handleToggle = () => {
        if (isActive && ticket.status === 'Em Progresso') {
            // This is where the modal would be triggered if it was for list view actions
            // For now, list view uses direct toggle or edit. Kanban uses the new TicketActionModal.
            // To unify, this could also set state to open TicketActionModal with correct targetStatus.
            // However, the prompt is specific to Kanban DND.
            // So, we keep the original list view behavior for this button.
            // A refactor could make onToggleTimer also open the modal if a reason/checklist is needed.
            setIsStopModalOpen(true); // This uses the OLD StopTimerModal, not the new TicketActionModal
                                     // This needs to be updated if list view should use the new modal.
                                     // For this subtask, we assume this is fine and focus on Kanban.
        } else {
            if (ticket.status !== 'Concluído') { onToggleTimer(ticket.id, ticket.status); }
        }
    };
    // This handleStopConfirm is for the OLD StopTimerModal, used by TicketItem
    const handleStopConfirm = async (reason, checklist, isCompleting) => {
        await onToggleTimer(ticket.id, ticket.status, reason, checklist, isCompleting);
        setIsStopModalOpen(false);
    };
    const handleDelete = () => { onDeleteTicket(ticket.id); setIsConfirmDeleteOpen(false); };
    const getStatusStyles = () => {
        switch (ticket.status) {
            case 'Em Progresso': return { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500', itemText: 'text-gray-100' };
            case 'Em Espera': return { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500', itemText: 'text-gray-100' };
            case 'Concluído': return { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500', itemText: 'text-gray-300' };
            case 'Pendente': return { bg: 'bg-slate-700', text: 'text-gray-400', border: 'border-slate-600', itemText: 'text-gray-200' };
            default: return { bg: 'bg-slate-700', text: 'text-gray-400', border: 'border-slate-600', itemText: 'text-gray-200'};
        }
    };
    const styles = getStatusStyles();

    return (
        <div className={`p-3 rounded-lg shadow-lg border-l-4 ${styles.bg} ${styles.border} mb-4 transition-all duration-300`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className={`flex-grow mb-3 sm:mb-0 ${styles.itemText} space-y-1`}>
                    <div className="flex items-center justify-between">
                        <h4 className={`text-lg font-semibold ${styles.itemText}`}>{ticket.subject}</h4>
                        <button onClick={() => setExpanded(!expanded)} className={`p-1 ${styles.text} hover:text-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400`}>{expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>
                    </div>
                    <p className="text-xs text-gray-400">ID: {ticket.ticketIdInput} <span className="text-gray-500 mx-1">|</span> Cliente: {ticket.accountName || 'N/A'}</p>
                    <p className="text-xs text-gray-400">Prioridade: <span className={getPriorityClass(ticket.priority)}>{ticket.priority}</span> <span className="text-gray-500 mx-1">|</span> Dificuldade: {ticket.difficulty}</p>
                    <p className="text-xs text-gray-400">Criado em: {formatDateFromISO(ticket.creationTime)}</p>
                    <p className={`text-sm font-semibold ${styles.text}`}>Status: {ticket.status}</p>
                </div>
                <div className="flex flex-col items-stretch sm:items-end space-y-2 w-full sm:w-auto">
                    <div className="text-xl font-mono text-indigo-300 tracking-wider flex items-center justify-end sm:justify-start"><Clock size={20} className="inline mr-1.5 text-indigo-400" />{formatTime(currentElapsedTime)}</div>
                    <div className="flex space-x-2 justify-end sm:justify-start w-full">
                        {ticket.status !== 'Concluído' && (
                            <button onClick={handleToggle} className={`py-1.5 px-2.5 rounded-md text-white transition-colors duration-150 flex items-center space-x-1 text-xs shadow-sm hover:shadow-md ${isActive && ticket.status === 'Em Progresso' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>
                                {isActive && ticket.status === 'Em Progresso' ? <Pause size={14} /> : <Play size={14} />}
                                <span>{isActive && ticket.status === 'Em Progresso' ? 'Pausar/Parar' : (ticket.status === 'Em Espera' ? 'Retomar' : 'Iniciar')}</span>
                            </button>
                        )}
                        <button onClick={() => onEditTicket(ticket)} title="Editar Ticket" className="py-1.5 px-2.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-150 shadow-sm hover:shadow-md"><Edit3 size={14} /></button>
                        <button onClick={() => setIsConfirmDeleteOpen(true)} title="Excluir Ticket" className="py-1.5 px-2.5 bg-slate-600 text-white rounded-md hover:bg-slate-500 transition-colors duration-150 shadow-sm hover:shadow-md"><Trash2 size={14} /></button>
                    </div>
                </div>
            </div>
            {expanded && (
                <div className={`mt-3 pt-2 border-t ${styles.border} border-opacity-50 ${styles.itemText}`}>
                    <h5 className="text-sm font-semibold mb-1.5 text-gray-200">Log de Atividades:</h5>
                    {ticket.log && ticket.log.length > 0 ? (<ul className="space-y-1 text-xs max-h-32 overflow-y-auto bg-slate-700/50 p-2 rounded-md shadow-inner">{ticket.log.slice().reverse().map((entry, index) => (<li key={index} className="p-1 rounded-sm text-gray-300 hover:bg-slate-600/40"><strong className="text-indigo-300 font-medium">{formatDateTimeFromISO(entry.timestamp)}:</strong> {entry.action}{entry.reason && <span className="text-gray-400 italic"> (Motivo: {entry.reason})</span>}{entry.checklist && (<span className="text-gray-400 text-[0.7rem] block mt-0.5">(Ticket: {entry.checklist.respondeuTicket ? 'Sim' : 'Não'}, Planilha: {entry.checklist.respondeuPlanilha ? 'Sim' : 'Não'})</span>)}</li>))}</ul>) : (<p className="text-xs text-gray-400">Nenhuma atividade registrada.</p>)}
                    <h5 className="text-sm font-semibold mt-3 mb-1.5 text-gray-200">Checklist Atual:</h5>
                    <ul className="text-sm space-y-1.5 text-gray-300">
                        <li className="flex items-center p-1">{ticket.checklist?.respondeuTicket ? <CheckCircle size={16} className="text-green-400 mr-2"/> : <XCircle size={16} className="text-red-400 mr-2"/>}Respondeu Ticket Principal</li>
                        <li className="flex items-center p-1">{ticket.checklist?.respondeuPlanilha ? <CheckCircle size={16} className="text-green-400 mr-2"/> : <XCircle size={16} className="text-red-400 mr-2"/>}Atualizou Planilha</li>
                    </ul>
                </div>
            )}
            {/* TicketItem still uses the original StopTimerModal for its play/pause button.
                This needs to be decided if it should also use TicketActionModal.
                For now, sticking to the subtask which is about DND in Kanban.
            */}
            {/* Corrected: TicketItem should use OriginalStopTimerModal */}
            <OriginalStopTimerModal
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

// Definition for OriginalStopTimerModal (logic from the old StopTimerModal)
const OriginalStopTimerModal = ({ isOpen, onClose, onStopConfirm, ticket }) => {
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

    if (!isOpen || !ticket) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isCompleting ? `Completar Ticket: ${ticket.subject}` : `Colocar em Espera: ${ticket.subject}`}>
            <div className="space-y-4">
                {modalMessage && <p className="text-red-500 text-sm mb-2 p-2 bg-red-100 rounded">{modalMessage}</p>}
                {!isCompleting && (<div><label htmlFor="originalReason" className="block text-sm font-medium text-gray-700">Motivo da Espera *</label><textarea id="originalReason" value={reason} onChange={(e) => setReason(e.target.value)} rows="3" required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900" placeholder="Ex: Aguardando resposta do cliente, Faltando informação..." /></div>)}
                {isCompleting && (<div className="space-y-2 pt-2"><p className="text-sm font-medium text-gray-700">Checklist de Finalização *</p><label className="flex items-center space-x-2 text-sm text-gray-600"><input type="checkbox" checked={respondeuTicket} onChange={(e) => setRespondeuTicket(e.target.checked)} className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" /><span>Respondeu o ticket na plataforma principal?</span></label><label className="flex items-center space-x-2 text-sm text-gray-600"><input type="checkbox" checked={respondeuPlanilha} onChange={(e) => setRespondeuPlanilha(e.target.checked)} className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" /><span>Atualizou a planilha de controle?</span></label></div>)}
                <div className="flex justify-end space-x-3 pt-4"><button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">Cancelar</button><button onClick={() => { setIsCompleting(false); handleConfirmWrapper(false); }} className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600">Colocar em Espera</button><button onClick={() => { setIsCompleting(true); handleConfirmWrapper(true); }} className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600">Completar Tarefa</button></div>
            </div>
        </Modal>
    );
};

const ReportsView = ({ tickets }) => {
    const [reportType, setReportType] = useState('daily');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState(null);
    const [isLoadingReport, setIsLoadingReport] = useState(false);

    const generateReport = () => {
        setIsLoadingReport(true); setReportData(null);
        if (reportType === 'daily') {
            const dailySummary = tickets.map(ticket => {
                let actionsOnDay = [];
                (ticket.log || []).forEach(logEntry => {
                    const logEntryDate = new Date(logEntry.timestamp);
                    const logYear = logEntryDate.getFullYear(); const logMonth = (logEntryDate.getMonth() + 1).toString().padStart(2, '0'); const logDay = logEntryDate.getDate().toString().padStart(2, '0');
                    const localLogDateString = `${logYear}-${logMonth}-${logDay}`;
                    if (localLogDateString === selectedDate) { actionsOnDay.push(`${formatDateTimeFromISO(logEntry.timestamp)}: ${logEntry.action} ${logEntry.reason ? '('+logEntry.reason+')':''}`); }
                });
                return { id: ticket.id, subject: ticket.subject, timeSpentDisplay: actionsOnDay.length > 0 ? formatTime(ticket.elapsedTime) : formatTime(0), actions: actionsOnDay, };
            }).filter(t => t.actions.length > 0);
            const displayDate = new Date(selectedDate + "T12:00:00");
            setReportData({ type: 'daily', date: formatDateFromISO(displayDate.toISOString()), summary: dailySummary });
        } else if (reportType === 'weekly') {
            const targetLocalDate = new Date(selectedDate + "T12:00:00");
            const dayOfWeek = targetLocalDate.getDay(); const diffToSunday = targetLocalDate.getDate() - dayOfWeek;
            const weekStart = new Date(targetLocalDate); weekStart.setDate(diffToSunday); weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23, 59, 59, 999);
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
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
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
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [toast, setToast] = useState({ message: '', type: '', key: 0 });

    const [ticketForStopModal, setTicketForStopModal] = useState(null);
    const [isStopModalOpenForKanban, setIsStopModalOpenForKanban] = useState(false);
    const [kanbanDragDestinationStatus, setKanbanDragDestinationStatus] = useState(null);

    // filteredTickets is already memoized and contains the tickets respecting all active filters.
    const filteredTickets = useMemo(() => {
        let sortedTickets = [...tickets];
        sortedTickets.sort((a, b) => {
            const priorityOrder = { "Solicitado por Terceiros": 0, "Alto Impacto": 1, "Médio Impacto": 2, "Baixo Impacto": 3 };
            const statusOrder = { 'Em Progresso': 1, 'Em Espera': 2, 'Pendente': 3, 'Concluído': 4 }; // MODIFIED Pausado to Em Espera
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
            const ticketDate = new Date(t.creationTime); const ticketDateString = ticketDate.toISOString().split('T')[0];
            const filterEndDateString = new Date(filterEndDate).toISOString().split('T')[0]; return ticketDateString <= filterEndDateString;
        });
        if (filterPriority) filtered = filtered.filter(t => t.priority === filterPriority);
        if (filterDifficulty) filtered = filtered.filter(t => t.difficulty === filterDifficulty);
        if (filterClient) { filtered = filtered.filter(t => t.accountName && t.accountName.toLowerCase().includes(filterClient.toLowerCase())); }
        return filtered;
    }, [tickets, ticketFilter, activeTicketId, filterStartDate, filterEndDate, filterPriority, filterDifficulty, filterClient]);


    const groupedTicketsForKanban = useMemo(() => {
        const groups = {};
        KANBAN_COLUMNS.forEach(column => { groups[column.status] = []; });
        // Use filteredTickets directly
        filteredTickets.forEach(ticket => {
            if (groups[ticket.status]) { groups[ticket.status].push(ticket); }
            else { console.warn(`Ticket ${ticket.id} with unhandled status for Kanban: ${ticket.status}`); }
        });
        // Sorting within columns can still be useful for visual consistency if desired,
        // though filteredTickets already has a primary sort.
        // For Kanban, usually, the order within a column might be manually managed by drag-and-drop
        // or by a specific Kanban-related field (e.g., manual rank).
        // If we want to keep the same sort order as the list view (within status),
        // filteredTickets is already sorted that way.
        // The original sort inside this useMemo was by lastUpdatedAt/createdAt.
        // Let's retain a similar sort for consistency within columns if no DND has happened.
        KANBAN_COLUMNS.forEach(column => {
             if (groups[column.status]) {
                 groups[column.status].sort((a, b) => { // This sort is now secondary to the main filteredTickets sort
                     const timeA = new Date(a.lastUpdatedAt || a.createdAt);
                     const timeB = new Date(b.lastUpdatedAt || b.createdAt);
                     return timeB - timeA;
                 });
             }
         });
        return groups;
    }, [filteredTickets]); // Depends on filteredTickets now

    const showToast = (message, type = 'info') => {
        const newKey = Date.now();
        setToast({ message, type, key: newKey });
        // Make showToast globally available for ClientManagementView if needed, or pass it down.
        // For now, ClientManagementView defines its own placeholder.
        // This is the main App's showToast.
        window.globalShowToast = (msg, toastType) => setToast({ message: msg, type: toastType, key: Date.now() });
        setTimeout(() => { setToast(prev => (prev.key === newKey ? { message: '', type: '', key: 0 } : prev)); }, 3000);
    };
    useEffect(() => { // Make the main app's showToast globally available for simplicity in this exercise
        window.globalShowToast = showToast;
        return () => { delete window.globalShowToast; } // Cleanup
    }, [showToast]);


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
    
    const handleToggleTimer = useCallback(async (ticketIdToToggle, currentStatus, reason = null, checklist = null, isCompleting = false, finalStatusFromDrag = null) => {
        const currentTicketData = tickets.find(t => t.id === ticketIdToToggle);
        if (!currentTicketData) return;
        let updatePayload = {};
        if (!(currentTicketData.isActive && currentTicketData.status === 'Em Progresso')) { // Starting or resuming a task
            if (activeTicketId && activeTicketId !== ticketIdToToggle) {
                const activeTicketRunningData = tickets.find(t => t.id === activeTicketId);
                if (activeTicketRunningData && activeTicketRunningData.status === 'Em Progresso' && activeTicketRunningData.currentTimerStartTime) {
                    const activeSessionSeconds = Math.floor((Date.now() - new Date(activeTicketRunningData.currentTimerStartTime).getTime()) / 1000);
                    const newLogForOldTask = `Em espera automaticamente para iniciar: '${currentTicketData.subject}'`; // MODIFIED
                    try {
                        await ticketRepository.updateTicket(activeTicketId, {
                            ...activeTicketRunningData, elapsedTime: (activeTicketRunningData.elapsedTime || 0) + activeSessionSeconds,
                            isActive: false, status: 'Em Espera', currentTimerStartTime: null, log: addLogEntryToTicketObject(activeTicketRunningData.log, newLogForOldTask)  // MODIFIED status
                        });
                    } catch (err) { console.error("Erro ao colocar ticket ativo em espera:", err); } // MODIFIED message
                }
            }
            updatePayload = { ...currentTicketData, status: 'Em Progresso', isActive: true, currentTimerStartTime: new Date().toISOString(), log: addLogEntryToTicketObject(currentTicketData.log, currentTicketData.status === 'Em Espera' ? 'Tarefa Retomada' : 'Tarefa Iniciada') }; // MODIFIED status check
        } else { // Pausing or completing an active task
            const sessionSeconds = currentTicketData.currentTimerStartTime ? Math.floor((Date.now() - new Date(currentTicketData.currentTimerStartTime).getTime()) / 1000) : 0;
            updatePayload = { ...currentTicketData, elapsedTime: (currentTicketData.elapsedTime || 0) + sessionSeconds, isActive: false, currentTimerStartTime: null, checklist: checklist || currentTicketData.checklist };
            updatePayload.status = finalStatusFromDrag || (isCompleting ? 'Concluído' : 'Em Espera'); // MODIFIED default to Em Espera
            updatePayload.log = addLogEntryToTicketObject(currentTicketData.log, isCompleting ? 'Tarefa Concluída' : 'Tarefa em Espera', reason, checklist); // MODIFIED log
        }
        try { await ticketRepository.updateTicket(ticketIdToToggle, updatePayload); fetchTickets(); }
        catch (err) { console.error("Error toggling timer:", err); setError(err.message || "Erro ao atualizar o timer."); showToast(`Erro ao atualizar timer: ${err.message}`, "error");}
    }, [tickets, activeTicketId, ticketRepository, fetchTickets, showToast]);

    const handleDragEnd = async (result) => {
        const { source, destination, draggableId } = result;
        console.log('Drag ended:', { source, destination, draggableId });

        if (!destination) return;

        const sourceDroppableId = source.droppableId;
        const destinationDroppableId = destination.droppableId;

        if (sourceDroppableId === destinationDroppableId && source.index === destination.index) {
            return;
        }

        const draggedTicket = tickets.find(t => String(t.id) === draggableId);
        if (!draggedTicket) {
            console.error("Dragged ticket not found");
            return;
        }

        // Restriction for "Concluído" tickets
        if (draggedTicket.status === 'Concluído' && destinationDroppableId !== 'Pendente') {
            showToast("Tickets concluídos só podem ser movidos para o Backlog (Pendente).", "info");
            return; // Prevent the move
        }

        const originalTicketsOrder = { ...groupedTicketsForKanban };

        // Optimistically update UI for reordering within the same column
        if (sourceDroppableId === destinationDroppableId) {
            const columnKey = source.droppableId;
            const itemsInColumn = Array.from(originalTicketsOrder[columnKey] || []);
            const [reorderedItem] = itemsInColumn.splice(source.index, 1);
            itemsInColumn.splice(destination.index, 0, reorderedItem);

            const newGroupedTickets = { ...originalTicketsOrder, [columnKey]: itemsInColumn };
            // This optimistic update of `setTickets` might be tricky if `tickets` is not directly what `groupedTicketsForKanban` uses.
            // It's better to update the source that `groupedTicketsForKanban` derives from, or manage order separately.
            // For now, let's assume `filteredTickets` is the source and DND reordering is primarily visual or needs specific backend handling.
            // The current `groupedTicketsForKanban` sorts by time, so manual DND order isn't persisted in its current structure without more complex state management.
            // For this subtask, focusing on filtering, DND reordering logic will be kept simple.
            // A full DND reordering persistence would require updating `lastUpdatedAt` or a dedicated order field.
            console.log("Reordered within column (visual only, or needs backend integration for persistence)");
            // To reflect this visual change immediately if not persisting, one might need to update `tickets` state in a way that respects this new order.
            // This is complex if `filteredTickets` is the primary source for `groupedTicketsForKanban`.
            // For now, we will rely on `fetchTickets` to refresh if an actual change was made.
        }


        if (sourceDroppableId !== destinationDroppableId) { // Moved between columns
            if (destinationDroppableId === 'Em Progresso') {
                // No status change needed if already 'Em Progresso' due to filtering, but timer logic is key
                if (draggedTicket.status !== 'Em Progresso' || !draggedTicket.isActive) {
                    await handleToggleTimer(String(draggedTicket.id), draggedTicket.status); // Ensure ID is string
                } else { // Already 'Em Progresso' and active, no change needed, but refresh to be sure
                    fetchTickets();
                }
            } else if (draggedTicket.status === 'Em Progresso' && (destinationDroppableId === 'Em Espera' || destinationDroppableId === 'Concluído')) {
                setTicketForStopModal(draggedTicket);
                setKanbanDragDestinationStatus(destinationDroppableId);
                setIsStopModalOpenForKanban(true);
            } else { // Other status changes
                try {
                    await ticketRepository.updateTicket(String(draggedTicket.id), { status: destinationDroppableId, log: addLogEntryToTicketObject(draggedTicket.log, `Status alterado para ${destinationDroppableId} via DND Kanban`) });
                    fetchTickets(); // Refresh data
                    showToast("Ticket movido com sucesso!", "success");
                } catch (error) {
                    console.error("Error updating ticket status via DND Kanban:", error);
                    showToast(`Erro ao mover ticket: ${error.message}`, "error");
                    // Revert optimistic update if necessary, though fetchTickets() will do this.
                }
            }
        } else { // Reordered within the same column - purely visual or needs specific backend logic
             // If not persisting order via backend, the list will revert to its original sort on next `fetchTickets`
             // or when `filteredTickets` recalculates without new order info.
             // For now, no specific action for reordering if not changing column status.
             // The console log above covers this.
        }
    };


    const handleDeleteTicket = async (ticketId) => {
        try { await ticketRepository.deleteTicket(ticketId); fetchTickets(); }
        catch (err) { console.error("Error deleting ticket:", err); setError(err.message || "Erro ao deletar ticket."); }
    };
    const handleTicketAddedOrUpdated = () => { fetchTickets(); setIsTicketModalOpen(false); setEditingTicket(null); };
    const handleEditTicket = (ticket) => { setEditingTicket(ticket); setIsTicketModalOpen(true); };
    const handleCloseTicketModal = () => { setIsTicketModalOpen(false); setEditingTicket(null); };

    // activeTicketDetails is already memoized using 'tickets' which is fine.
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
                        <div className="flex items-center space-x-2 mb-2 sm:mb-0"><BarChart3 size={32} className="text-indigo-400" /><h1 className="text-2xl font-bold tracking-tight text-white">Gerenciador de Tempo</h1></div>
                        <nav className="flex space-x-1 sm:space-x-3 items-center">
                            <button onClick={() => setCurrentView('tickets')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'tickets' ? 'bg-indigo-500 text-white' : 'text-gray-300 hover:bg-slate-700 hover:text-white'}`}><ListChecks size={18} className="inline mr-1" /> Lista</button>
                            <button onClick={() => setCurrentView('kanban')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'kanban' ? 'bg-indigo-500 text-white' : 'text-gray-300 hover:bg-slate-700 hover:text-white'}`}><LayoutDashboard size={18} className="inline mr-1" /> Kanban</button>
                            <button onClick={() => setCurrentView('clients')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'clients' ? 'bg-emerald-500 text-white' : 'text-gray-300 hover:bg-slate-700 hover:text-white'}`}><Users size={18} className="inline mr-1" /> Clientes</button>
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
                                    <option value="abertos">Abertos</option><option value="concluidos">Concluídos</option><option value="todos">Todos</option>
                                </select>
                                <button onClick={() => setShowAdvancedFilters(v => !v)} className="ml-2 px-3 py-2 text-xs rounded bg-indigo-600 hover:bg-indigo-700 text-white flex items-center space-x-1">
                                    <Filter size={14}/><span>{showAdvancedFilters ? 'Ocultar Filtros' : 'Filtros Avançados'}</span>
                                </button>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                <button onClick={() => setIsClientModalOpen(true)} className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out flex items-center space-x-2 w-full sm:w-auto justify-center">
                                    <UserPlus size={20} /><span>Cadastrar Cliente</span>
                                </button>
                                <button onClick={() => { setEditingTicket(null); setIsTicketModalOpen(true); }} className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out flex items-center space-x-2 w-full sm:w-auto justify-center">
                                    <PlusCircle size={20} /><span>Adicionar Ticket</span>
                                </button>
                            </div>
                        </div>
                        {showAdvancedFilters && (
                            <div className="mb-6 bg-slate-800 p-4 rounded-lg shadow">
                                <h4 className="text-lg font-semibold text-gray-100 mb-3">Filtros Avançados</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
                                    <div><label htmlFor="filterStartDate" className="block text-xs font-medium text-gray-300 mb-1">Data Inicial</label><input type="date" id="filterStartDate" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="w-full bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm" /></div>
                                    <div><label htmlFor="filterEndDate" className="block text-xs font-medium text-gray-300 mb-1">Data Final</label><input type="date" id="filterEndDate" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="w-full bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm" /></div>
                                    <div><label htmlFor="filterPriority" className="block text-xs font-medium text-gray-300 mb-1">Prioridade</label><select id="filterPriority" value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="w-full bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm"><option value="">Todas</option><option value="Solicitado por Terceiros">Solicitado por Terceiros</option><option value="Alto Impacto">Alto Impacto</option><option value="Médio Impacto">Médio Impacto</option><option value="Baixo Impacto">Baixo Impacto</option></select></div>
                                    <div><label htmlFor="filterDifficulty" className="block text-xs font-medium text-gray-300 mb-1">Dificuldade</label><select id="filterDifficulty" value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)} className="w-full bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm"><option value="">Todas</option><option value="Fácil">Fácil</option><option value="Médio">Médio</option><option value="Difícil">Difícil</option></select></div>
                                    <div><label htmlFor="filterClientInput" className="block text-xs font-medium text-gray-300 mb-1">Cliente</label><input type="text" id="filterClientInput" value={filterClient} onChange={e => setFilterClient(e.target.value)} placeholder="Digite para buscar cliente..." className="w-full bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm" list="advanced-client-filter-list" autoComplete="off" /><datalist id="advanced-client-filter-list">{clients.filter(client => filterClient.trim() === '' || client.name.toLowerCase().includes(filterClient.toLowerCase())).map(client => (<option key={client.id} value={client.name} />))}</datalist></div>
                                    <div className="self-end"><button onClick={() => { setFilterStartDate(''); setFilterEndDate(''); setFilterPriority(''); setFilterDifficulty(''); setFilterClient(''); }} className="w-full px-3 py-2 text-sm rounded bg-slate-600 hover:bg-slate-500 text-white">Limpar Filtros</button></div>
                                </div>
                            </div>
                        )}
                        {isLoading && <div className="text-center py-10 text-gray-300">Carregando tickets...</div>}
                        {!isLoading && !error && filteredTickets.length === 0 && !isTicketModalOpen && currentView === 'tickets' && (<div className="text-center py-10 bg-slate-800 rounded-lg shadow-md"><p className="text-xl text-gray-400">Nenhum ticket encontrado para o filtro atual.</p>{ticketFilter === 'abertos' && <p className="text-gray-500">Adicione um novo ticket para começar ou altere o filtro.</p>}</div>)}
                        {!isLoading && !error && filteredTickets.length > 0 && currentView === 'tickets' && (<div className="space-y-4">{filteredTickets.map(ticket => (<TicketItem key={ticket.id} ticket={ticket} onToggleTimer={handleToggleTimer} onDeleteTicket={handleDeleteTicket} onEditTicket={handleEditTicket} activeTicketId={activeTicketId}/>))}</div>)}
                    </>)}
                    {currentView === 'kanban' && (
                        <>
                        {/* Filter UI for Kanban View - Copied and adapted from Ticket List View */}
                        <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex items-center space-x-2 p-2 bg-slate-800 rounded-lg">
                                <Filter size={20} className="text-indigo-400"/>
                                <select value={ticketFilter} onChange={(e) => setTicketFilter(e.target.value)} className="bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm">
                                    <option value="abertos">Abertos</option>
                                    <option value="concluidos">Concluídos</option>
                                    <option value="todos">Todos</option>
                                </select>
                                <button onClick={() => setShowAdvancedFilters(v => !v)} className="ml-2 px-3 py-2 text-xs rounded bg-indigo-600 hover:bg-indigo-700 text-white flex items-center space-x-1">
                                    <Filter size={14}/><span>{showAdvancedFilters ? 'Ocultar Filtros' : 'Filtros Avançados'}</span>
                                </button>
                            </div>
                            {/* Add New Ticket button is already in KanbanColumn for 'Pendente' */}
                        </div>
                        {showAdvancedFilters && (
                            <div className="mb-6 bg-slate-800 p-4 rounded-lg shadow">
                                <h4 className="text-lg font-semibold text-gray-100 mb-3">Filtros Avançados</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
                                    <div><label htmlFor="filterStartDateKanban" className="block text-xs font-medium text-gray-300 mb-1">Data Inicial</label><input type="date" id="filterStartDateKanban" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="w-full bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm" /></div>
                                    <div><label htmlFor="filterEndDateKanban" className="block text-xs font-medium text-gray-300 mb-1">Data Final</label><input type="date" id="filterEndDateKanban" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="w-full bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm" /></div>
                                    <div><label htmlFor="filterPriorityKanban" className="block text-xs font-medium text-gray-300 mb-1">Prioridade</label><select id="filterPriorityKanban" value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="w-full bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm"><option value="">Todas</option><option value="Solicitado por Terceiros">Solicitado por Terceiros</option><option value="Alto Impacto">Alto Impacto</option><option value="Médio Impacto">Médio Impacto</option><option value="Baixo Impacto">Baixo Impacto</option></select></div>
                                    <div><label htmlFor="filterDifficultyKanban" className="block text-xs font-medium text-gray-300 mb-1">Dificuldade</label><select id="filterDifficultyKanban" value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)} className="w-full bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm"><option value="">Todas</option><option value="Fácil">Fácil</option><option value="Médio">Médio</option><option value="Difícil">Difícil</option></select></div>
                                    <div><label htmlFor="filterClientInputKanban" className="block text-xs font-medium text-gray-300 mb-1">Cliente</label><input type="text" id="filterClientInputKanban" value={filterClient} onChange={e => setFilterClient(e.target.value)} placeholder="Digite para buscar cliente..." className="w-full bg-slate-700 text-gray-200 border border-slate-600 rounded-md p-2 text-sm" list="advanced-client-filter-list-kanban" autoComplete="off" /><datalist id="advanced-client-filter-list-kanban">{clients.filter(client => filterClient.trim() === '' || client.name.toLowerCase().includes(filterClient.toLowerCase())).map(client => (<option key={client.id} value={client.name} />))}</datalist></div>
                                    <div className="self-end"><button onClick={() => { setFilterStartDate(''); setFilterEndDate(''); setFilterPriority(''); setFilterDifficulty(''); setFilterClient(''); }} className="w-full px-3 py-2 text-sm rounded bg-slate-600 hover:bg-slate-500 text-white">Limpar Filtros</button></div>
                                </div>
                            </div>
                        )}
                        {isLoading && <div className="text-center py-10 text-gray-300">Carregando tickets...</div>}
                        {!isLoading && !error && filteredTickets.length === 0 && !isTicketModalOpen && currentView === 'kanban' && (
                            <div className="text-center py-10 bg-slate-800 rounded-lg shadow-md">
                                <p className="text-xl text-gray-400">Nenhum ticket encontrado para o filtro atual no Kanban.</p>
                                {ticketFilter === 'abertos' && <p className="text-gray-500">Adicione um novo ticket ou altere o filtro.</p>}
                            </div>
                        )}
                        {/* Render KanbanView only if not loading, no error, and there are tickets to show or modal is not open (to avoid layout shift) */}
                        {(!isLoading && !error && (filteredTickets.length > 0 || isTicketModalOpen)) && (
                           <KanbanView
                                columns={KANBAN_COLUMNS}
                                groupedTickets={groupedTicketsForKanban}
                                onEditTicket={handleEditTicket}
                                onDeleteTicket={handleDeleteTicket}
                                onToggleTimer={handleToggleTimer}
                                activeTicketId={activeTicketId}
                                getPriorityClass={getPriorityClass}
                                formatTime={formatTime}
                                formatDateTimeFromISO={formatDateTimeFromISO}
                                onDragEnd={handleDragEnd}
                                onOpenTicketModal={() => { setEditingTicket(null); setIsTicketModalOpen(true); }}
                            />
                        )}
                        </>
                    )}
                    {currentView === 'reports' && (<ReportsView tickets={tickets} />)}
                    {currentView === 'clients' && ( <ClientManagementView /> )}
                            onEditTicket={handleEditTicket}
                            onDeleteTicket={handleDeleteTicket}
                            onToggleTimer={handleToggleTimer}
                            activeTicketId={activeTicketId}
                            getPriorityClass={getPriorityClass}
                            formatTime={formatTime}
                            formatDateTimeFromISO={formatDateTimeFromISO}
                            onDragEnd={handleDragEnd}
                            onOpenTicketModal={() => { setEditingTicket(null); setIsTicketModalOpen(true); }} // Pass the handler
                        />
                    )}
                    {currentView === 'reports' && (<ReportsView tickets={tickets} />)}
                    {currentView === 'clients' && ( <ClientManagementView /> )}
                </main>
                <TicketModal isOpen={isTicketModalOpen} onClose={handleCloseTicketModal} ticketToEdit={editingTicket} onTicketAddedOrUpdated={handleTicketAddedOrUpdated} clients={clients} showToast={showToast} onOpenClientModal={() => setIsClientModalOpen(true)} />
                {/* ClientModal for adding clients, uses the main App's showToast indirectly via onClientAdded */}
                <ClientModal
                    isOpen={isClientModalOpen}
                    onClose={() => setIsClientModalOpen(false)}
                    onClientAdded={() => {
                        fetchClients().then(newClients => {
                            setClients(newClients);
                            // If ClientManagementView is active, it will refetch. If not, this updates App's client list.
                            // This relies on ClientManagementView's useEffect to pick up changes if it's the current view,
                            // or handleClientAdded in ClientManagementView.
                            // The current structure means ClientManagementView is independent for its client list.
                            // This global client list in App is primarily for the TicketModal.
                        });
                        setIsClientModalOpen(false);
                        showToast("Cliente cadastrado com sucesso!", "success"); // Uses App's showToast
                    }}
                />
                    {isStopModalOpenForKanban && ticketForStopModal && kanbanDragDestinationStatus && (
                    <TicketActionModal
                        isOpen={isStopModalOpenForKanban}
                        onClose={() => {
                            setIsStopModalOpenForKanban(false);
                            setTicketForStopModal(null);
                            setKanbanDragDestinationStatus(null);
                            // fetchTickets(); // Fetch tickets only after action is confirmed, not on close
                        }}
                        onConfirm={async (reason, checklist) => { // Changed from onStopConfirm
                            if (!ticketForStopModal || !kanbanDragDestinationStatus) return;

                            const isCurrentlyEmProgresso = ticketForStopModal.status === 'Em Progresso';
                            const isTargetEmProgresso = kanbanDragDestinationStatus === 'Em Progresso';
                             const isTargetConcluido = kanbanDragDestinationStatus === 'Concluído';

                            if (isCurrentlyEmProgresso && !isTargetEmProgresso) {
                                // Moving from 'Em Progresso' to a non-'Em Progresso' state (e.g., Espera, Concluido, Pendente)
                                // This requires stopping the timer and then setting the new status.
                                await handleToggleTimer(
                                    ticketForStopModal.id,
                                    ticketForStopModal.status, // current status
                                    reason,
                                    checklist,
                                    isTargetConcluido, // isCompleting flag
                                    kanbanDragDestinationStatus // final status from drag
                                );
                            } else if (!isCurrentlyEmProgresso && isTargetEmProgresso) {
                                // This case should be handled by the direct call to handleToggleTimer in handleDragEnd
                                // and not open the modal. If it reaches here, it's an unexpected state.
                                console.warn("TicketActionModal opened unexpectedly for target 'Em Progresso' from non-'Em Progresso' state.");
                                await handleToggleTimer(ticketForStopModal.id, ticketForStopModal.status);
                            } else {
                                // General case: Not moving from 'Em Progresso' OR moving to 'Em Progresso' (which is handled above or directly)
                                // OR moving between non 'Em Progresso' states e.g. Pendente -> Em Espera
                                const logAction = `Status alterado de ${ticketForStopModal.status} para ${kanbanDragDestinationStatus}`;
                                const newLog = addLogEntryToTicketObject(ticketForStopModal.log, logAction, reason, isTargetConcluido ? checklist : null);
                                try {
                                    await ticketRepository.updateTicket(ticketForStopModal.id, {
                                        ...ticketForStopModal, // spread existing ticket data
                                        status: kanbanDragDestinationStatus,
                                        log: newLog,
                                        ...(isTargetConcluido && { checklist }), // Add checklist if completing
                                        // Ensure timer related fields are nullified if not moving to 'Em Progresso'
                                        isActive: false,
                                        currentTimerStartTime: null,
                                    });
                                    showToast(`Ticket "${ticketForStopModal.subject}" atualizado para ${kanbanDragDestinationStatus}.`, "success");
                                } catch (error) {
                                    console.error("Erro ao atualizar ticket via modal:", error);
                                    showToast(`Erro ao atualizar ticket: ${error.message}`, "error");
                                }
                            }
                            fetchTickets(); // Refresh data after action
                            setIsStopModalOpenForKanban(false);
                            setTicketForStopModal(null);
                            setKanbanDragDestinationStatus(null);
                        }}
                        ticket={ticketForStopModal}
                        targetStatus={kanbanDragDestinationStatus} // Pass targetStatus to the modal
                    />
                )}
                <footer className="text-center py-6 text-sm text-gray-500 border-t border-slate-700 mt-10"><p>&copy; {new Date().getFullYear()} Gerenciador de Tempo Local.</p></footer>
            </div>
        </TicketRepositoryContext.Provider>
    );
}

export default App;