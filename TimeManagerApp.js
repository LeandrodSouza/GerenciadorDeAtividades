import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    doc, 
    getDoc,
    onSnapshot, 
    query, 
    updateDoc,
    Timestamp,
    deleteDoc,
    serverTimestamp,
    // where // Keep for potential future use in reports
} from 'firebase/firestore';
import { Clock, Play, Pause, PlusCircle, CalendarDays, Trash2, Edit3, ListChecks, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Save, Filter, FileText, BarChart3 } from 'lucide-react';

// --- Configuração do Firebase ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "YOUR_API_KEY", 
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-time-manager-app-refactored';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Firestore instance

// --- Definição da Entidade (Conceitual) ---
// Em um projeto maior, TicketEntity seria uma classe ou interface em um arquivo separado.
// interface TicketEntity {
//   id?: string;
//   ticketIdInput: string;
//   subject: string;
//   accountName: string;
//   priority: string;
//   difficulty: string;
//   creationTime: Timestamp;
//   status: 'Pendente' | 'Em Progresso' | 'Pausado' | 'Concluído';
//   elapsedTime: number;
//   isActive: boolean;
//   log: Array<{ timestamp: Timestamp; action: string; reason?: string; checklist?: object }>;
//   checklist: { respondeuTicket: boolean; respondeuPlanilha: boolean };
//   userId: string;
//   currentTimerStartTime?: Timestamp | null;
//   lastUpdatedAt?: Timestamp;
//   createdAt?: Timestamp;
// }

// --- Camada de Serviço de Persistência (Firebase Ticket Repository Adapter) ---
// Implementa (conceitualmente) uma ITicketRepositoryPort
const firebaseTicketService = {
    _getTicketsCollectionPath: (userId) => `artifacts/${appId}/users/${userId}/tickets`,

    // Converte dados do Firestore para um formato mais próximo da entidade
    _fromFirestore: (docSnap) => {
        if (!docSnap.exists()) return null;
        const data = docSnap.data();
        return {
            id: docSnap.id,
            ...data,
            // Garante que Timestamps sejam Timestamps
            creationTime: data.creationTime instanceof Timestamp ? data.creationTime : Timestamp.fromDate(new Date()),
            currentTimerStartTime: data.currentTimerStartTime instanceof Timestamp ? data.currentTimerStartTime : null,
            lastUpdatedAt: data.lastUpdatedAt instanceof Timestamp ? data.lastUpdatedAt : null,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
            log: Array.isArray(data.log) ? data.log.map(l => ({...l, timestamp: l.timestamp instanceof Timestamp ? l.timestamp : Timestamp.now() })) : [],
        };
    },

    // Converte dados da entidade para o formato do Firestore
    _toFirestore: (ticketData) => {
        const data = { ...ticketData };
        delete data.id; // ID não é armazenado no documento em si
        // Timestamps já devem estar no formato correto ou ser serverTimestamp()
        return data;
    },

    async addTicket(userId, ticketData) {
        const collectionPath = this._getTicketsCollectionPath(userId);
        const dataToSave = this._toFirestore({
            ...ticketData,
            createdAt: serverTimestamp(),
            lastUpdatedAt: serverTimestamp(),
        });
        const docRef = await addDoc(collection(db, collectionPath), dataToSave);
        return docRef.id;
    },

    async getTicket(userId, ticketId) {
        const docRef = doc(db, this._getTicketsCollectionPath(userId), ticketId);
        const docSnap = await getDoc(docRef);
        return this._fromFirestore(docSnap);
    },

    async updateTicket(userId, ticketId, data) {
        const docRef = doc(db, this._getTicketsCollectionPath(userId), ticketId);
        const dataToSave = this._toFirestore({
            ...data,
            lastUpdatedAt: serverTimestamp(),
        });
        await updateDoc(docRef, dataToSave);
    },

    async deleteTicket(userId, ticketId) {
        const docRef = doc(db, this._getTicketsCollectionPath(userId), ticketId);
        await deleteDoc(docRef);
    },

    subscribeToTickets(userId, onUpdate) {
        const collectionPath = this._getTicketsCollectionPath(userId);
        const q = query(collection(db, collectionPath));
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const ticketsData = [];
            let currentActiveId = null;
            querySnapshot.forEach((docSnap) => {
                const ticket = this._fromFirestore(docSnap);
                if (ticket) {
                    ticketsData.push(ticket);
                    if (ticket.isActive && ticket.status === 'Em Progresso') {
                        currentActiveId = ticket.id;
                    }
                }
            });
            onUpdate(ticketsData, currentActiveId);
        }, (error) => {
            console.error("Error in subscribeToTickets:", error);
            onUpdate([], null, error); // Pass error to callback
        });
        return unsubscribe; // Retorna a função de cancelamento da inscrição
    }
};

// --- Contexto do Repositório de Tickets ---
// Em um projeto maior, ITicketRepository seria uma interface TypeScript.
// const ITicketRepository = { /* ... metodos ... */ }
const TicketRepositoryContext = createContext(firebaseTicketService); // Fornece o serviço Firebase por padrão

// Hook para usar o repositório de tickets
const useTicketRepository = () => useContext(TicketRepositoryContext);


// --- Funções Auxiliares (mesmas de antes) ---
const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};
const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    if (timestamp instanceof Timestamp) return timestamp.toDate().toLocaleDateString('pt-BR');
    if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return 'Data inválida';
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('pt-BR');
    }
    return 'Data inválida';
};
const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    if (timestamp instanceof Timestamp) return timestamp.toDate().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    return 'Data/Hora inválida';
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
            setCreationDate(ticketToEdit.creationTime ? (ticketToEdit.creationTime.toDate ? ticketToEdit.creationTime.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0]);
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
            creationTime: Timestamp.fromDate(new Date(creationDate + "T00:00:00")), // Garante que é o início do dia
            status: ticketToEdit ? ticketToEdit.status : 'Pendente',
            elapsedTime: ticketToEdit ? ticketToEdit.elapsedTime : 0,
            isActive: ticketToEdit ? ticketToEdit.isActive : false,
            log: ticketToEdit ? ticketToEdit.log : [],
            checklist: ticketToEdit ? ticketToEdit.checklist : { respondeuTicket: false, respondeuPlanilha: false },
            userId,
            // createdAt e lastUpdatedAt serão definidos pelo serviço
        };
        // Se estiver editando, preserva o ID e createdAt original
        if (ticketToEdit) {
            ticketDataObject.createdAt = ticketToEdit.createdAt;
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
        setCurrentElapsedTime(ticket.elapsedTime); 
        if (isActive && ticket.status === 'Em Progresso' && ticket.currentTimerStartTime) {
            const initialNow = Timestamp.now();
            // currentTimerStartTime pode ser null se o ticket foi ativado mas o dado ainda não propagou
            const startTimeSeconds = ticket.currentTimerStartTime instanceof Timestamp ? ticket.currentTimerStartTime.seconds : initialNow.seconds;
            const initialSessionSeconds = initialNow.seconds - startTimeSeconds;
            setCurrentElapsedTime(ticket.elapsedTime + initialSessionSeconds);

            const intervalId = setInterval(() => {
                const now = Timestamp.now();
                const currentStartTimeSeconds = ticket.currentTimerStartTime instanceof Timestamp ? ticket.currentTimerStartTime.seconds : now.seconds;
                const sessionSeconds = now.seconds - currentStartTimeSeconds;
                setCurrentElapsedTime(ticket.elapsedTime + sessionSeconds);
            }, 1000);
            setTimerIntervalId(intervalId);
            return () => clearInterval(intervalId);
        } else if (timerIntervalId) {
            clearInterval(timerIntervalId);
            setTimerIntervalId(null);
        }
    }, [isActive, ticket.status, ticket.currentTimerStartTime, ticket.elapsedTime]);


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
                    <p className="text-sm ">ID: {ticket.ticketIdInput} | Conta: {ticket.accountName || 'N/A'}</p>
                    <p className="text-sm ">Prioridade: <span className={getPriorityClass(ticket.priority)}>{ticket.priority}</span> | Dificuldade: {ticket.difficulty}</p>
                    <p className="text-sm ">Criado em: {formatDate(ticket.creationTime)}</p>
                    <p className={`text-sm font-medium ${styles.text}`}>Status: {ticket.status}</p>
                </div>
                <div className="flex flex-col items-end space-y-2 w-full sm:w-auto">
                    <div className="text-2xl font-mono text-indigo-400 tracking-wider">
                        <Clock size={22} className="inline mr-2" />{formatTime(currentElapsedTime)}
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
        const date = new Date(selectedDate + "T00:00:00"); 

        if (reportType === 'daily') {
            const dayStart = Timestamp.fromDate(date);
            const dayEnd = Timestamp.fromDate(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999));
            
            filteredTickets = tickets.filter(t => {
                const lastUpdated = t.lastUpdatedAt?.toDate() || t.creationTime?.toDate();
                return lastUpdated >= dayStart.toDate() && lastUpdated <= dayEnd.toDate();
            });
            const dailySummary = filteredTickets.map(ticket => {
                let timeOnDay = 0;
                let actionsOnDay = [];
                (ticket.log || []).forEach(logEntry => {
                    if (logEntry.timestamp.toDate().toDateString() === date.toDateString()) {
                        actionsOnDay.push(`${formatDateTime(logEntry.timestamp)}: ${logEntry.action} ${logEntry.reason ? '('+logEntry.reason+')':''}`);
                    }
                });
                if (actionsOnDay.length > 0) timeOnDay = ticket.elapsedTime;

                return {
                    id: ticket.id,
                    subject: ticket.subject,
                    timeSpentDisplay: formatTime(timeOnDay), 
                    actions: actionsOnDay,
                };
            }).filter(t => t.actions.length > 0);
            setReportData({ type: 'daily', date: formatDate(date), summary: dailySummary });

        } else if (reportType === 'weekly') {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay()); 
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23,59,59,999);

            const weekStartTS = Timestamp.fromDate(weekStart);
            const weekEndTS = Timestamp.fromDate(weekEnd);

            filteredTickets = tickets.filter(t => {
                const lastUpdated = t.lastUpdatedAt?.toDate() || t.creationTime?.toDate();
                return lastUpdated >= weekStartTS.toDate() && lastUpdated <= weekEndTS.toDate();
            });
            const weeklySummary = filteredTickets.map(ticket => ({
                id: ticket.id,
                subject: ticket.subject,
                totalTime: formatTime(ticket.elapsedTime), 
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

    // Autenticação Firebase
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                try {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                         await signInWithCustomToken(auth, __initial_auth_token);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) { console.error("Error during sign-in:", error); setUserId(null); }
            }
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, []);
    
    // Listener de Tickets usando o serviço
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


    // Lógica de Negócio / Casos de Uso (ainda dentro do App, mas usando o serviço)
    // Em uma arquitetura mais completa, seriam UseCase classes/funções separadas.
    const addLogEntryToTicketObject = (ticketLog, action, reason = null, checklistState = null) => {
        const newLogEntry = {
            timestamp: Timestamp.now(),
            action: action,
            ...(reason && { reason: reason }),
            ...(checklistState && { checklist: checklistState })
        };
        const currentLog = Array.isArray(ticketLog) ? ticketLog : [];
        return [...currentLog, newLogEntry];
    };
    
    const handleToggleTimer = useCallback(async (ticketIdToToggle, currentStatus, reason = null, checklist = null, isCompleting = false) => {
        if (!userId) return;
        
        const currentTicketData = await ticketRepository.getTicket(userId, ticketIdToToggle);
        if (!currentTicketData) return;

        let updateData = {};
        let newLog = currentTicketData.log || [];

        if (!(currentTicketData.isActive && currentTicketData.status === 'Em Progresso')) { // Start/Resume
            if (activeTicketId && activeTicketId !== ticketIdToToggle) {
                const activeTicketRunningData = await ticketRepository.getTicket(userId, activeTicketId);
                if (activeTicketRunningData && activeTicketRunningData.status === 'Em Progresso' && activeTicketRunningData.currentTimerStartTime) {
                    const activeSessionSeconds = Timestamp.now().seconds - activeTicketRunningData.currentTimerStartTime.seconds;
                    await ticketRepository.updateTicket(userId, activeTicketId, {
                        elapsedTime: activeTicketRunningData.elapsedTime + activeSessionSeconds,
                        isActive: false,
                        status: 'Pausado',
                        currentTimerStartTime: null,
                        log: addLogEntryToTicketObject(activeTicketRunningData.log, 'Pausado automaticamente (outra tarefa iniciada)'),
                    });
                }
            }
            updateData = {
                status: 'Em Progresso',
                isActive: true,
                currentTimerStartTime: Timestamp.now(),
                log: addLogEntryToTicketObject(newLog, currentTicketData.status === 'Pausado' ? 'Tarefa Retomada' : 'Tarefa Iniciada'),
            };
        } else { // Pause/Stop/Complete
            const sessionSeconds = currentTicketData.currentTimerStartTime ? (Timestamp.now().seconds - currentTicketData.currentTimerStartTime.seconds) : 0;
            updateData = {
                elapsedTime: currentTicketData.elapsedTime + sessionSeconds,
                isActive: false,
                currentTimerStartTime: null,
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
            await ticketRepository.updateTicket(userId, ticketIdToToggle, updateData);
        } catch (error) {
            console.error("Error toggling timer:", error);
        }
    }, [userId, activeTicketId, ticketRepository]);

    const handleDeleteTicket = async (ticketId) => {
        if (!userId) return;
        try {
            await ticketRepository.deleteTicket(userId, ticketId);
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
            const timeA = a.lastUpdatedAt || a.creationTime || a.createdAt;
            const timeB = b.lastUpdatedAt || b.creationTime || b.createdAt;

            if (timeA && timeB) { // Ambos têm timestamps válidos
                 // Assegura que são objetos Date para comparação
                const dateA = timeA.toDate ? timeA.toDate() : new Date(timeA);
                const dateB = timeB.toDate ? timeB.toDate() : new Date(timeB);
                return dateB - dateA; // Mais recente primeiro
            }
            if (timeA) return -1; // a tem data, b não
            if (timeB) return 1;  // b tem data, a não
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
        if (activeTicketDetails && activeTicketDetails.status === 'Em Progresso' && activeTicketDetails.currentTimerStartTime) {
            const update = () => {
                 const now = Timestamp.now();
                 const startTime = activeTicketDetails.currentTimerStartTime;
                 // Verifica se startTime é um Timestamp válido antes de acessar .seconds
                 const sessionSeconds = startTime && startTime.seconds ? now.seconds - startTime.seconds : 0;
                 setHeaderTime(activeTicketDetails.elapsedTime + sessionSeconds);
            };
            update(); 
            intervalId = setInterval(update, 1000);
        } else if (activeTicketDetails) {
            setHeaderTime(activeTicketDetails.elapsedTime);
        } else {
            setHeaderTime(0);
        }
        return () => clearInterval(intervalId);
    }, [activeTicketDetails]);

    // JSX da Aplicação (Header, Main, Footer) - sem alterações visuais significativas
    if (!isAuthReady) { /* ... */ 
        return <div className="flex items-center justify-center min-h-screen bg-slate-900"><div className="text-xl font-semibold text-gray-300">Autenticando...</div></div>;
    }
    if (!userId) { /* ... */ 
         return <div className="flex items-center justify-center min-h-screen bg-slate-900 p-4 text-center">
            <div className="bg-slate-800 p-8 rounded-lg shadow-xl">
                <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-gray-100 mb-2">Falha na Autenticação</h2>
                <p className="text-gray-400">Não foi possível autenticar o usuário. Por favor, recarregue a página ou contate o suporte se o problema persistir.</p>
                <p className="text-xs text-gray-500 mt-4">ID da App: {appId}</p>
            </div>
        </div>;
    }

    return (
        <TicketRepositoryContext.Provider value={firebaseTicketService}> {/* Fornece o serviço */}
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
                            <p className="text-xl sm:text-2xl font-mono tracking-wider">{formatTime(headerTime)}</p>
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
                                            key={ticket.id} 
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
                    <p>&copy; {new Date().getFullYear()} Gerenciador de Tempo. App ID: {appId}</p>
                </footer>
            </div>
        </TicketRepositoryContext.Provider>
    );
}

export default App;

