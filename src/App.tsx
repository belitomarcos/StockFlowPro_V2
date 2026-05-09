import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Toaster, toast } from 'sonner';
import { 
  Package, Plus, Minus, Trash2, Database, X, Server, Settings, ArrowLeft, Users, MapPin, Search, History, ArrowDownRight, ArrowUpRight, AlertCircle, BarChart as BarChartIcon, Printer, FileText, Edit2, Download, Camera, LayoutDashboard, ShoppingCart, CheckCircle, Save, XCircle, ShoppingBag, PlusCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie } from 'recharts';
import { BarcodeScanner } from './BarcodeScanner';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type Produto = {
  id: string | number;
  nome: string;
  quantidade: number;
  sku?: string;
  est_minimo?: number;
};

type Destino = {
  id: string | number;
  nome: string;
};

type Tecnico = {
  id: string | number;
  nome: string;
};

type Movimentacao = {
  id: string | number;
  produto_id: string | number;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  destino_id?: string | number;
  tecnico_id?: string | number;
  created_at?: string;
  data_movimentacao?: string;
  produtos?: { nome: string };
  destinos?: { nome: string };
  tecnicos?: { nome: string };
};

type Compra = {
  id: string;
  produto_id?: string | number | null;
  nome: string;
  quantidade: number;
  status: 'Pendente' | 'Pedido Feito' | 'Entregue';
};

export default function App() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [historico, setHistorico] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [compras, setCompras] = useState<Compra[]>(() => {
    const saved = localStorage.getItem('@stockflowpro/compras');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState<'inventario' | 'historico' | 'config' | 'relatorios' | 'dashboard' | 'compras'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDestinoId, setSelectedDestinoId] = useState<string>('');
  const [selectedTecnicoId, setSelectedTecnicoId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isRemovingDuplicates, setIsRemovingDuplicates] = useState(false);
  const isConfigured = supabaseUrl && supabaseKey;

  const topSaidasData = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const saidas = historico.filter(m => {
      const dataMov = m.data_movimentacao || m.created_at;
      return m.tipo === 'saida' && dataMov && new Date(dataMov) >= thirtyDaysAgo;
    });
    
    const aggregated: Record<string, number> = {};
    saidas.forEach(saida => {
      const p = produtos.find(prod => prod.id === saida.produto_id);
      const name = p ? p.nome : `ID: ${saida.produto_id}`;
      aggregated[name] = (aggregated[name] || 0) + saida.quantidade;
    });

    const sorted = Object.entries(aggregated)
      .map(([name, quantidade]) => ({ name, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5); // top 5

    return sorted;
  }, [historico, produtos]);

  const saidasPorDestinoData = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const saidas = historico.filter(m => {
      const dataMov = m.data_movimentacao || m.created_at;
      return m.tipo === 'saida' && dataMov && new Date(dataMov) >= thirtyDaysAgo;
    });
    
    const aggregated: Record<string, number> = {};
    saidas.forEach(saida => {
      let destName = 'Não Informado';
      if (saida.destino_id) {
         const dest = destinos.find(d => String(d.id) === String(saida.destino_id));
         if (dest) destName = dest.nome;
      }
      aggregated[destName] = (aggregated[destName] || 0) + saida.quantidade;
    });

    return Object.entries(aggregated)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [historico, destinos]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCompraModalOpen, setIsCompraModalOpen] = useState(false);
  const [editingCompra, setEditingCompra] = useState<Compra | null>(null);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [actionModal, setActionModal] = useState<{ isOpen: boolean, type: 'entrada' | 'saida', produto: Produto | null }>({
    isOpen: false,
    type: 'entrada',
    produto: null
  });

  const fetchData = async () => {
    if (!isConfigured || !supabase) {
      setLoading(false);
      return;
    }
    
    const [resProdutos, resDestinos, resTecnicos, resHistorico] = await Promise.all([
      supabase.from('produtos').select('*').order('nome'),
      supabase.from('destinos').select('*').order('nome'),
      supabase.from('tecnicos').select('*').order('nome'),
      supabase.from('movimentacao_estoque').select('*, produtos(nome), tecnicos(nome), destinos(nome)').order('id', { ascending: false }).limit(100)
    ]);

    if (resProdutos.error) {
      toast.error('Erro ao buscar produtos.');
    } else {
      setProdutos(resProdutos.data || []);
    }
    
    if (resDestinos.data) {
      setDestinos(resDestinos.data);
    }

    if (resTecnicos.data) {
      setTecnicos(resTecnicos.data);
    }

    if (resHistorico && !resHistorico.error && resHistorico.data) {
      setHistorico(resHistorico.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    localStorage.setItem('@stockflowpro/compras', JSON.stringify(compras));
  }, [compras]);

  const gerarSugestoesCompras = () => {
    const produtosParaReposicao = produtos.filter(p => p.est_minimo != null && p.quantidade <= p.est_minimo);
    
    setCompras(prev => {
      const novas = [...prev];
      let added = 0;
      
      for (const p of produtosParaReposicao) {
        // Verifica se já existe compra não entregue para este produto
        const jaExiste = novas.some(c => c.produto_id === String(p.id) && c.status !== 'Entregue');
        if (!jaExiste) {
          const sugestaoAuto = (p.est_minimo || 0) * 2 - p.quantidade;
          novas.push({
            id: crypto.randomUUID(),
            produto_id: String(p.id),
            nome: p.nome,
            quantidade: sugestaoAuto > 0 ? sugestaoAuto : 1,
            status: 'Pendente'
          });
          added++;
        }
      }
      
      if (added > 0) {
        toast.success(`${added} nova(s) sugestão(ões) adicionada(s)!`);
      } else {
        toast.info('Nenhuma nova sugestão no momento.');
      }
      
      return novas;
    });
  };

  const handleExcluir = async (id: string | number) => {
    if (!supabase) return;
    const { error } = await supabase.from('produtos').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir produto.');
    } else {
      toast.success('Produto removido do sistema.');
      fetchData();
    }
  };

  const handleAddProduto = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nome = formData.get('nome') as string;
    const quantidade = Number(formData.get('quantidade'));

    if (!nome.trim() || isNaN(quantidade)) {
      return toast.error('Preencha os campos corretamente.');
    }

    if (!supabase) return;
    
    setIsSubmitting(true);
    
    try {
      const nomeFormatado = nome.trim().toLowerCase();
      const produtoExistente = produtos.find(p => p.nome.trim().toLowerCase() === nomeFormatado && (!editingProduto || p.id !== editingProduto.id));
      
      if (produtoExistente) {
        toast.error('Este produto já está cadastrado!');
        return;
      }

      const payload = {
        nome, 
        quantidade,
        sku: formData.get('sku') ? String(formData.get('sku')) : null,
        est_minimo: formData.get('est_minimo') ? Number(formData.get('est_minimo')) : null
      };

      if (editingProduto) {
        const { error } = await supabase.from('produtos').update(payload).eq('id', editingProduto.id);
        if (error) {
          toast.error('Erro ao atualizar produto.');
          console.error(error);
        } else {
          toast.success('Produto atualizado com sucesso!');
          setEditingProduto(null);
          setIsAddModalOpen(false);
          fetchData();
        }
      } else {
        const { error } = await supabase.from('produtos').insert([payload]);
        if (error) {
          toast.error('Erro ao cadastrar produto.');
          console.error(error);
        } else {
          toast.success('Produto cadastrado com sucesso!');
          setIsAddModalOpen(false);
          fetchData();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!actionModal.produto) return;

    const formData = new FormData(e.currentTarget);
    const quantidade_digitada = Number(formData.get('quantidade'));
    const destino_id = formData.get('destino_id');
    const tecnico_id = formData.get('tecnico_id');

    if (isNaN(quantidade_digitada) || quantidade_digitada <= 0) {
      return toast.error('Digite uma quantidade válida maior que 0.');
    }

    if (actionModal.type === 'saida') {
      if (!selectedDestinoId) return toast.error('Selecione um destino para a saída.');
      if (!selectedTecnicoId) return toast.error('Selecione um técnico responsável para a saída.');
    }

    const saldo_anterior = Number(actionModal.produto.quantidade);
    
    let nova_quantidade = 0;

    // Regra matemática aplicada rigorosamente conforme solicitado.
    if (actionModal.type === 'saida') {
        nova_quantidade = Number(saldo_anterior) - Number(quantidade_digitada);
        if (nova_quantidade < 0) {
          return toast.error('Estoque insuficiente');
        }
    } else {
        nova_quantidade = Number(saldo_anterior) + Number(quantidade_digitada);
    }

    if (!supabase) return;
    
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('produtos')
        .update({ quantidade: nova_quantidade })
        .eq('id', actionModal.produto.id);

      if (error) {
        toast.error(`Erro ao registrar ${actionModal.type}.`);
        console.error(error);
      } else {
        // Salva cada operação na tabela movimentacao_estoque
        const payload: any = {
          produto_id: actionModal.produto.id,
          tipo: actionModal.type,
          quantidade: quantidade_digitada,
          data_movimentacao: new Date().toISOString()
        };

        if (actionModal.type === 'saida') {
          payload.destino_id = selectedDestinoId;
          payload.tecnico_id = selectedTecnicoId;
        }

        const { error: historyError } = await supabase
          .from('movimentacao_estoque')
          .insert([payload]);

        if (historyError) {
          console.error('Erro ao registrar histórico', historyError);
          toast.error(`Aviso: O estoque foi alterado, mas houve erro ao salvar no histórico.`);
        }

        toast.success(`${actionModal.type === 'entrada' ? 'Entrada' : 'Saída'} registrada com sucesso.`);
        setActionModal({ isOpen: false, type: 'entrada', produto: null });
        setSelectedDestinoId('');
        setSelectedTecnicoId('');
        await fetchData(); // Force reload
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddDestino = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const nome = formData.get('nome') as string;
    
    if (!nome.trim()) return toast.error('Nome do destino inválido.');
    
    const { error } = await supabase.from('destinos').insert([{ nome }]);
    if (error) toast.error('Erro ao cadastrar destino.');
    else {
      toast.success('Destino cadastrado.');
      form.reset();
      fetchData();
    }
  };

  const handleExcluirDestino = async (id: string | number) => {
    if (!supabase) return;
    const { error } = await supabase.from('destinos').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir destino.');
    else {
      toast.success('Destino removido.');
      fetchData();
    }
  };

  const handleAddTecnico = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const nome = formData.get('nome') as string;
    
    if (!nome.trim()) return toast.error('Nome do técnico inválido.');
    
    const { error } = await supabase.from('tecnicos').insert([{ nome }]);
    if (error) toast.error('Erro ao cadastrar técnico.');
    else {
      toast.success('Técnico cadastrado.');
      form.reset();
      fetchData();
    }
  };

  const handleExcluirTecnico = async (id: string | number) => {
    if (!supabase) return;
    const { error } = await supabase.from('tecnicos').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir técnico.');
    else {
      toast.success('Técnico removido.');
      fetchData();
    }
  };

  const handleRemoveDuplicates = async () => {
    if (!supabase) return;
    setIsRemovingDuplicates(true);
    try {
      const { data: allProducts, error } = await supabase.from('produtos').select('*');
      if (error) throw error;

      // Group by normalized name
      const grouped: Record<string, typeof allProducts> = {};
      for (const p of allProducts) {
        const key = p.nome.trim().toLowerCase();
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(p);
      }

      let removedCount = 0;

      for (const key in grouped) {
        const group = grouped[key];
        if (group.length > 1) {
          // Sort to keep the oldest created item
          group.sort((a, b) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return timeA - timeB;
          });
          const keep = group[0];
          const toRemove = group.slice(1);

          let quantityToAdd = 0;
          const idsToDelete = [];

          for (const duplicate of toRemove) {
            quantityToAdd += duplicate.quantidade;
            idsToDelete.push(duplicate.id);
          }

          // Update main item quantity if any
          if (quantityToAdd > 0) {
            await supabase.from('produtos').update({ quantidade: keep.quantidade + quantityToAdd }).eq('id', keep.id);
          }

          // Reassign history and delete duplicates
          if (idsToDelete.length > 0) {
            for (const dupId of idsToDelete) {
               await supabase.from('movimentacao_estoque').update({ produto_id: keep.id }).eq('produto_id', dupId);
            }
            await supabase.from('produtos').delete().in('id', idsToDelete);
            removedCount += idsToDelete.length;
          }
        }
      }

      if (removedCount > 0) {
        toast.success(`${removedCount} produto(s) duplicado(s) removido(s).`);
        await fetchData();
      } else {
        toast.info('Nenhum produto duplicado foi encontrado.');
      }

    } catch (e) {
      console.error(e);
      toast.error('Erro durante a limpeza de duplicados.');
    } finally {
      setIsRemovingDuplicates(false);
    }
  };

  const handleDownloadCSV = () => {
    if (compras.length === 0) {
      toast.info('Nenhuma sugestão de compra na lista para exportar.');
      return;
    }

    const headers = ['Protocolo ID', 'Produto', 'Quantidade Sugerida', 'Status'];
    const rows = compras.map(compra => {
      return [
        compra.id.substring(0, 8),
        `"${compra.nome.replace(/"/g, '""')}"`,
        compra.quantidade,
        compra.status
      ].join(';');
    });

    const csvContent = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob(["\uFEFF", csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'gestao_compras.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-slate-100 p-6">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-xl space-y-4 border border-slate-700">
          <div className="flex items-center space-x-3 text-sky-400">
            <Database size={32} />
            <h1 className="text-2xl font-bold">Configuração Pendente</h1>
          </div>
          <p className="text-slate-400 leading-relaxed">
            As variáveis de ambiente do Supabase não foram encontradas. Lembre-se de configurar a sua URL e Key Anônima para conectar ao seu banco de dados pessoal.
          </p>
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-lg text-sm font-mono text-slate-300 break-all">
            VITE_SUPABASE_URL=...<br />
            VITE_SUPABASE_ANON_KEY=...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 selection:bg-sky-500/30 font-sans">
      <Toaster theme="dark" position="top-right" />
      
      {/* Navbar Superior */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-full mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-sky-500/10 p-2 rounded-lg text-sky-400">
              <Server size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">StockFlowPro <span className="text-sky-400">V2.0</span></h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            {activeTab === 'inventario' && (
              <>
                <button 
                  onClick={() => setIsScannerOpen(true)}
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors duration-200 border border-emerald-500/20"
                >
                  <Camera size={18} />
                  <span className="hidden sm:inline">Escanear</span>
                </button>
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors duration-200"
                >
                  <Plus size={18} />
                  <span className="hidden sm:inline">Novo Ativo</span>
                </button>
              </>
            )}
            
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg flex items-center space-x-2 transition-colors duration-200 ${activeTab === 'dashboard' ? 'bg-sky-500/10 text-sky-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
              title="Dashboard"
            >
              <LayoutDashboard size={18} />
              <span className="hidden sm:inline font-medium">Dashboard</span>
            </button>

            <button 
              onClick={() => setActiveTab('inventario')}
              className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg flex items-center space-x-2 transition-colors duration-200 ${activeTab === 'inventario' ? 'bg-sky-500/10 text-sky-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
              title="Inventário"
            >
              <Package size={18} />
              <span className="hidden sm:inline font-medium">Inventário</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('historico')}
              className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg flex items-center space-x-2 transition-colors duration-200 ${activeTab === 'historico' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
              title="Histórico de Movimentações"
            >
              <History size={18} />
              <span className="hidden sm:inline font-medium">Histórico</span>
            </button>

            <button 
              onClick={() => setActiveTab('compras')}
              className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg flex items-center space-x-2 transition-colors duration-200 ${activeTab === 'compras' ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
              title="Gestão de Compras"
            >
              <ShoppingCart size={18} />
              <span className="hidden sm:inline font-medium">Gestão de Compras</span>
            </button>

            <button 
              onClick={() => setActiveTab('config')}
              className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg flex items-center space-x-2 transition-colors duration-200 ${activeTab === 'config' ? 'bg-sky-500/10 text-sky-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
              title="Configurações"
            >
              <Settings size={18} />
              <span className="hidden sm:inline font-medium">Config.</span>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-full mx-auto px-6 py-8 print:p-0 print:m-0 print:max-w-none">
        {activeTab === 'dashboard' ? (
          <div className="space-y-6">
            {/* Dashboard Cards de Resumo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-center space-x-4 shadow-sm">
                <div className="bg-sky-500/10 p-3 rounded-lg text-sky-400">
                  <Package size={24} />
                </div>
                <div>
                  <p className="text-sm text-slate-400 font-medium tracking-wide">Total de Itens</p>
                  <h3 className="text-2xl font-bold text-slate-200">
                    {produtos.reduce((acc, p) => acc + p.quantidade, 0)} <span className="text-sm font-normal text-slate-500 ml-1">em estoque</span>
                  </h3>
                </div>
              </div>
              
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-center space-x-4 shadow-sm">
                <div className="bg-red-500/10 p-3 rounded-lg text-red-400">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <p className="text-sm text-slate-400 font-medium tracking-wide">Alertas Críticos</p>
                  <h3 className="text-2xl font-bold text-red-400">
                    {produtos.filter(p => p.est_minimo != null && p.quantidade <= p.est_minimo).length} <span className="text-sm font-normal text-slate-500 ml-1">produtos</span>
                  </h3>
                </div>
              </div>

              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-center space-x-4 shadow-sm">
                <div className="bg-rose-500/10 p-3 rounded-lg text-rose-400">
                  <ArrowDownRight size={24} />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm text-slate-400 font-medium tracking-wide">Última Saída</p>
                  <h3 className="text-base font-bold text-slate-200 truncate" title={(() => {
                    const last = historico.find(m => m.tipo === 'saida');
                    if (!last) return 'Nenhuma';
                    const p = produtos.find(p => p.id === last.produto_id);
                    return p ? p.nome : `ID: ${last.produto_id}`;
                  })()}>
                    {(() => {
                      const last = historico.find(m => m.tipo === 'saida');
                      if (!last) return 'Nenhuma';
                      const p = produtos.find(p => p.id === last.produto_id);
                      return p ? p.nome : `Produto Excluído`;
                    })()}
                  </h3>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de Barras - Top Saídas */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 shadow-sm">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="bg-rose-500/10 p-2 rounded-lg text-rose-400">
                    <BarChartIcon size={20} />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-200">Top 5 Produtos em Saída (30 dias)</h2>
                </div>
                {topSaidasData.length > 0 ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topSaidasData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                        <XAxis type="number" stroke="#94a3b8" />
                        <YAxis dataKey="name" type="category" width={120} stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }} 
                          itemStyle={{ color: '#f43f5e' }} 
                        />
                        <Bar dataKey="quantidade" fill="#fb7185" radius={[0, 4, 4, 0]}>
                          {topSaidasData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239'][index % 5]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-8">Nenhuma saída registrada.</p>
                )}
              </div>

              {/* Gráfico de Pizza - Destinos */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 shadow-sm">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400">
                    <LayoutDashboard size={20} />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-200">Distribuição de Saídas (30 dias)</h2>
                </div>
                {saidasPorDestinoData.length > 0 ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={saidasPorDestinoData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={90}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {saidasPorDestinoData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#10b981', '#059669', '#047857', '#34d399', '#6ee7b7'][index % 5]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-8">Nenhuma saída registrada.</p>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'compras' ? (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 shadow-sm print:bg-white print:border-none print:shadow-none print:p-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 print:hidden gap-4">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-500/10 p-2 rounded-lg text-indigo-400">
                  <ShoppingCart size={20} />
                </div>
                <h2 className="text-lg font-semibold text-slate-200">Gestão de Compras</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={gerarSugestoesCompras}
                  className="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-4 py-2 rounded-lg font-medium transition-colors border border-indigo-500/20"
                >
                  <ShoppingCart size={18} />
                  Sugerir do Estoque
                </button>
                <button 
                  onClick={handleDownloadCSV}
                  className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-lg font-medium transition-colors border border-emerald-500/20"
                >
                  <Download size={18} />
                  Baixar Excel (CSV)
                </button>
                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <Printer size={18} />
                  Imprimir
                </button>
                <button 
                  onClick={() => { setEditingCompra(null); setIsCompraModalOpen(true); }}
                  className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-950 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <Plus size={18} />
                  Adicionar Manual
                </button>
              </div>
            </div>

            <div className="print-area">
              {compras.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <Package size={48} className="mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nenhuma sugestão na lista.</p>
                  <p className="text-sm mt-1">Gere sugestões automáticas ou adicione manualmente.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700/50 text-slate-400 text-sm">
                        <th className="py-3 px-4 font-semibold">Produto</th>
                        <th className="py-3 px-4 font-semibold text-right">Quantidade</th>
                        <th className="py-3 px-4 font-semibold text-center">Status</th>
                        <th className="py-3 px-4 text-center font-semibold text-slate-500 w-24">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compras.map(compra => (
                        <tr key={compra.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/20 transition-colors">
                          <td className="py-4 px-4 font-medium text-slate-200">{compra.nome}</td>
                          <td className="py-4 px-4 text-right font-bold text-slate-200">{compra.quantidade} un</td>
                          <td className="py-4 px-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                              compra.status === 'Entregue' ? 'bg-emerald-500/10 text-emerald-400' :
                              compra.status === 'Pedido Feito' ? 'bg-sky-500/10 text-sky-400' :
                              'bg-amber-500/10 text-amber-400'
                            }`}>
                              {compra.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                               <button 
                                onClick={() => { setEditingCompra(compra); setIsCompraModalOpen(true); }}
                                className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 rounded-md transition-colors"
                                title="Editar"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => setCompras(prev => prev.filter(c => c.id !== compra.id))}
                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                                title="Excluir"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'historico' ? (
          <div className="space-y-6">
            {/* Gráfico de Top Saídas */}
            {topSaidasData.length > 0 && (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 shadow-sm">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="bg-rose-500/10 p-2 rounded-lg text-rose-400">
                    <BarChartIcon size={20} />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-200">Top Saídas (Últimos 30 dias)</h2>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topSaidasData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                      <XAxis type="number" stroke="#94a3b8" />
                      <YAxis dataKey="name" type="category" width={120} stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }} 
                        itemStyle={{ color: '#f43f5e' }} 
                      />
                      <Bar dataKey="quantidade" fill="#fb7185" radius={[0, 4, 4, 0]}>
                        {topSaidasData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239'][index % 5]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 overflow-x-auto shadow-sm">
              <div className="flex items-center space-x-3 mb-6">
                <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400">
                  <History size={20} />
                </div>
                <h2 className="text-lg font-semibold text-slate-200">Histórico de Movimentações</h2>
              </div>
              
              {historico.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <History size={48} className="mb-4 opacity-50" />
                  <p>Nenhuma movimentação registrada no sistema.</p>
                </div>
              ) : (
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400 text-sm">
                    <th className="py-3 px-4 font-medium max-w-[140px]">Data/Hora</th>
                    <th className="py-3 px-4 font-medium">Tipo</th>
                    <th className="py-3 px-4 font-medium">Ativo (ID x Produto)</th>
                    <th className="py-3 px-4 font-medium text-right">Qtd</th>
                    <th className="py-3 px-4 font-medium">Destino / Técnico</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map(mov => {
                    const produtoNome = mov.produtos?.nome || produtos.find(p => String(p.id) === String(mov.produto_id))?.nome;
                    const destinoNome = mov.destinos?.nome || destinos.find(d => String(d.id) === String(mov.destino_id))?.nome;
                    const tecnicoNome = mov.tecnicos?.nome || tecnicos.find(t => String(t.id) === String(mov.tecnico_id))?.nome;
                    
                    const dataMov = mov.data_movimentacao || mov.created_at;
                    let dataFormatada = new Date().toLocaleString('pt-BR');
                    if (dataMov) {
                      dataFormatada = new Date(dataMov).toLocaleString('pt-BR');
                    }

                    return (
                      <tr key={mov.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="py-4 px-4 text-slate-300 text-sm whitespace-nowrap">{dataFormatada}</td>
                        <td className="py-4 px-4">
                          {mov.tipo === 'entrada' ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-md text-xs font-semibold">
                              <ArrowUpRight size={14} /> Entrada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-rose-400 bg-rose-400/10 border border-rose-400/20 px-2.5 py-1 rounded-md text-xs font-semibold">
                              <ArrowDownRight size={14} /> Saída
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {produtoNome ? (
                            <span className="text-slate-200 font-medium">{produtoNome}</span>
                          ) : (
                            <span className="text-slate-500 italic">Produto excluído (ID: {mov.produto_id})</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="text-slate-200 font-mono font-bold text-base">{mov.quantidade}</span>
                        </td>
                        <td className="py-4 px-4">
                          {mov.tipo === 'saida' ? (
                            <div className="flex flex-col">
                              {destinoNome ? <span className="font-medium text-slate-300">{destinoNome}</span> : <span className="text-slate-500 italic">Não informado</span>}
                              {tecnicoNome ? <span className="text-xs text-slate-400 mt-0.5">Resp: {tecnicoNome}</span> : null}
                            </div>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            </div>
          </div>
        ) : activeTab === 'config' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Técnicos */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="bg-sky-500/10 p-2 rounded-lg text-sky-400">
                  <Users size={20} />
                </div>
                <h2 className="text-lg font-semibold text-slate-200">Técnicos</h2>
              </div>
              
              <form onSubmit={handleAddTecnico} className="flex gap-2 mb-6">
                <input 
                  name="nome"
                  type="text"
                  placeholder="Nome do técnico"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-medium"
                  required
                />
                <button type="submit" className="bg-sky-500 hover:bg-sky-400 text-slate-950 px-4 rounded-lg font-semibold transition-colors">
                  Adicionar
                </button>
              </form>

              <div className="space-y-2">
                {tecnicos.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-4">Nenhum técnico cadastrado.</p>
                ) : (
                  tecnicos.map(t => (
                    <div key={t.id} className="flex items-center justify-between bg-slate-900/50 border border-slate-700/50 px-4 py-3 rounded-lg group hover:border-slate-600 transition-colors">
                      <span className="text-slate-300 font-medium">{t.nome}</span>
                      <button onClick={() => handleExcluirTecnico(t.id)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Destinos */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="bg-sky-500/10 p-2 rounded-lg text-sky-400">
                  <MapPin size={20} />
                </div>
                <h2 className="text-lg font-semibold text-slate-200">Destinos / Setores</h2>
              </div>
              
              <form onSubmit={handleAddDestino} className="flex gap-2 mb-6">
                <input 
                  name="nome"
                  type="text"
                  placeholder="Nome do destino"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-medium"
                  required
                />
                <button type="submit" className="bg-sky-500 hover:bg-sky-400 text-slate-950 px-4 rounded-lg font-semibold transition-colors">
                  Adicionar
                </button>
              </form>

              <div className="space-y-2">
                {destinos.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-4">Nenhum destino cadastrado.</p>
                ) : (
                  destinos.map(d => (
                    <div key={d.id} className="flex items-center justify-between bg-slate-900/50 border border-slate-700/50 px-4 py-3 rounded-lg group hover:border-slate-600 transition-colors">
                      <span className="text-slate-300 font-medium">{d.nome}</span>
                      <button onClick={() => handleExcluirDestino(d.id)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            {/* Ferramentas de Banco de Dados */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 md:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400">
                  <Database size={20} />
                </div>
                <h2 className="text-lg font-semibold text-slate-200">Manutenção do Banco de Dados</h2>
              </div>
              
              <div className="p-4 bg-slate-900/50 border border-slate-700/50 rounded-lg flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-200">Limpeza Automática de Duplicados</h3>
                  <p className="text-sm text-slate-400 mt-1 max-w-xl">
                    Busca produtos com nomes idênticos. Mantém o registro mais antigo, transfere o saldo dos duplicados para o principal e exclui os extras.
                  </p>
                </div>
                <button
                  onClick={handleRemoveDuplicates}
                  disabled={isRemovingDuplicates}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isRemovingDuplicates ? 'Limpando...' : 'Remover Duplicados'}
                </button>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-64 text-slate-500 space-x-3">
            <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Acessando banco de dados...</span>
          </div>
        ) : (
          <>
            {/* Csv Export removed, handled in Compras */}

            {/* Search Bar */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Buscar ativo por nome ou SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-10 py-3 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all shadow-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                    title="Limpar filtros"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/50 transition-colors hidden sm:flex items-center gap-2 whitespace-nowrap"
                >
                  <X size={16} />
                  Limpar Filtros
                </button>
              )}
            </div>

            {produtos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-800/20 mt-4">
                <Package size={48} className="text-slate-600 mb-4" />
                <p className="text-slate-400 text-lg font-medium">Inventário vazio. Adicione seu primeiro item.</p>
              </div>
            ) : (() => {
              const filteredProdutos = produtos.filter(p => {
                const search = (searchTerm || '').toLowerCase().trim();
                if (!search) return true; // Mostra tudo se a busca estiver vazia
                
                const nomeMatch = p.nome ? p.nome.toLowerCase().includes(search) : false;
                const skuMatch = p.sku ? p.sku.toLowerCase().includes(search) : false;
                
                return nomeMatch || skuMatch;
              });

              if (filteredProdutos.length === 0) {
                 return (
                  <div className="flex flex-col items-center justify-center h-64 border border-slate-800 rounded-2xl bg-slate-800/20 mt-4">
                    <Search size={40} className="text-slate-600 mb-4" />
                    <p className="text-slate-400 text-lg font-medium">Nenhum ativo encontrado para "{searchTerm}".</p>
                  </div>
                 );
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredProdutos.map(produto => {
                    const isLowStock = produto.est_minimo != null && produto.quantidade <= produto.est_minimo;
                    return (
                      <div key={produto.id} className={`bg-slate-800 rounded-xl border ${isLowStock ? 'border-red-500/50 hover:border-red-500/70' : 'border-slate-700/50 hover:border-slate-600'} p-4 flex flex-col transition-colors shadow-sm`}>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-medium text-slate-200 line-clamp-1 pr-2" title={produto.nome}>
                              <span className="text-slate-500 mr-2 text-sm">#{produtos.findIndex(p => p.id === produto.id) + 1}</span> {produto.nome}
                            </h3>
                            {produto.sku && (
                              <p className="text-xs text-slate-500 mt-1 font-mono">SKU: {produto.sku}</p>
                            )}
                          </div>
                          <div className="flex bg-slate-900 rounded-md border border-slate-700">
                            <button 
                              onClick={() => {
                                setEditingProduto(produto);
                                setIsAddModalOpen(true);
                              }}
                              className="text-slate-500 hover:text-sky-400 p-1.5 hover:bg-slate-800 transition-colors flex-shrink-0 border-r border-slate-700"
                              title="Editar Produto"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleExcluir(produto.id)}
                              className="text-slate-500 hover:text-red-400 p-1.5 hover:bg-slate-800 transition-colors flex-shrink-0"
                              title="Excluir Ativo (Ação Direta)"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        
                        <div className={`flex-1 flex flex-col justify-center items-center py-4 bg-slate-900/50 rounded-lg mb-4 border transition-all duration-300 ${isLowStock ? 'border-red-500/40 bg-red-500/5 drop-shadow-[0_0_12px_rgba(239,68,68,0.15)] shadow-[inset_0_0_20px_rgba(239,68,68,0.1)]' : 'border-slate-700/30'}`}>
                          <span className={`text-sm tracking-wider uppercase font-semibold mb-1 ${isLowStock ? 'text-red-400' : 'text-slate-500'}`}>Saldo Atual</span>
                          <span className={`text-4xl font-bold transition-all duration-300 ${isLowStock ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse' : 'text-sky-400'}`}>{produto.quantidade}</span>
                          {produto.est_minimo != null && (
                             <span className="text-xs text-slate-500 mt-2">Mínimo: {produto.est_minimo}</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-auto">
                          <button
                            onClick={() => setActionModal({ isOpen: true, type: 'saida', produto })}
                            className="flex justify-center items-center space-x-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg transition-colors border border-transparent hover:border-slate-600 font-medium"
                          >
                            <Minus size={16} />
                            <span>Saída</span>
                          </button>
                          <button
                            onClick={() => setActionModal({ isOpen: true, type: 'entrada', produto })}
                            className="flex justify-center items-center space-x-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 py-2.5 rounded-lg transition-colors border border-transparent hover:border-sky-500/30 font-medium"
                          >
                            <Plus size={16} />
                            <span>Entrada</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}
      </main>

      {isScannerOpen && (
        <BarcodeScanner 
          onClose={() => setIsScannerOpen(false)}
          onScan={(decodedText) => {
            setIsScannerOpen(false);
            const foundProduct = produtos.find(p => p.sku === decodedText);
            if (foundProduct) {
              if (actionModal.isOpen) {
                setActionModal({ ...actionModal, produto: foundProduct });
                toast.success('Produto localizado pelo código de barras!');
              } else {
                setActionModal({ isOpen: true, type: 'saida', produto: foundProduct });
                toast.success('Produto localizado pelo código de barras!');
              }
            } else {
              toast.error(`Nenhum produto encontrado com o código: ${decodedText}`);
            }
          }}
        />
      )}

      {/* MODAL: Adicionar/Editar Produto */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/80 flex-shrink-0">
              <h2 className="text-lg font-semibold text-slate-200">{editingProduto ? 'Editar Ativo de TI' : 'Novo Ativo de TI'}</h2>
              <button 
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingProduto(null);
                }} 
                className="text-slate-400 hover:text-slate-200 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddProduto} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5" htmlFor="nome">
                  Nome do Ativo
                </label>
                <input 
                  id="nome"
                  name="nome"
                  type="text"
                  autoComplete="off"
                  required
                  defaultValue={editingProduto?.nome || ''}
                  placeholder="Ex: Notebook Dell Latitude"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5" htmlFor="quantidade">
                  Quantidade Pró-forma
                </label>
                <input 
                  id="quantidade"
                  name="quantidade"
                  type="number"
                  required
                  readOnly={!!editingProduto}
                  defaultValue={editingProduto?.quantidade ?? 0}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5" htmlFor="sku">
                    SKU (Opcional)
                  </label>
                  <input 
                    id="sku"
                    name="sku"
                    type="text"
                    autoComplete="off"
                    defaultValue={editingProduto?.sku || ''}
                    placeholder="Ex: NB-DELL-01"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5" htmlFor="est_minimo">
                    Est. Mínimo (Opc)
                  </label>
                  <input 
                    id="est_minimo"
                    name="est_minimo"
                    type="number"
                    defaultValue={editingProduto?.est_minimo || ''}
                    placeholder="Ex: 5"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-mono"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingProduto(null);
                  }} 
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-700 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Salvando...' : (editingProduto ? 'Salvar Alterações' : 'Cadastrar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Ajuste de Estoque (Entrada / Saída) */}
      {actionModal.isOpen && actionModal.produto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/80 flex-shrink-0">
              <h2 className="text-lg font-semibold text-slate-200">
                {actionModal.type === 'entrada' ? 'Registrar Entrada' : 'Registrar Saída'}
              </h2>
              <button 
                type="button"
                onClick={() => setActionModal({ isOpen: false, type: 'entrada', produto: null })} 
                className="text-slate-400 hover:text-slate-200 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateStock} className="p-6">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm text-slate-400">Referência do Ativo</div>
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="text-xs flex items-center gap-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 px-2 py-1 rounded transition-colors"
                  >
                    <Camera size={14} /> Escanear Código
                  </button>
                </div>
                <div className="font-medium text-slate-200 text-lg bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 line-clamp-1" title={actionModal.produto.nome}>
                  {actionModal.produto.nome}
                </div>
                <div className="flex items-center justify-between mt-3 px-1">
                  <span className="text-slate-400 text-sm">Saldo Anterior:</span>
                  <span className="font-mono font-bold text-slate-300">{actionModal.produto.quantidade}</span>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-400 mb-1.5" htmlFor="actionQtd">
                  Input ({actionModal.type === 'entrada' ? '+' : '-'})
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    {actionModal.type === 'entrada' ? <Plus size={18} /> : <Minus size={18} />}
                  </div>
                  <input 
                    id="actionQtd"
                    name="quantidade"
                    type="number"
                    required
                    min="1"
                    defaultValue={1}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-mono text-xl"
                  />
                </div>
              </div>

              {actionModal.type === 'saida' && (
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5" htmlFor="destino_id">
                      Destino / Setor
                    </label>
                    <select 
                      id="destino_id"
                      name="destino_id"
                      required
                      value={selectedDestinoId}
                      onChange={(e) => setSelectedDestinoId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-medium appearance-none"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
                    >
                      <option value="">Selecione um destino...</option>
                      {destinos.map(d => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5" htmlFor="tecnico_id">
                      Técnico Responsável
                    </label>
                    <select 
                      id="tecnico_id"
                      name="tecnico_id"
                      required
                      value={selectedTecnicoId}
                      onChange={(e) => setSelectedTecnicoId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-medium appearance-none"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
                    >
                      <option value="">Selecione um técnico...</option>
                      {tecnicos.map(t => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-8">
                <button 
                  type="submit" 
                  disabled={isSubmitting || (actionModal.type === 'saida' && (!selectedDestinoId || !selectedTecnicoId))}
                  className={`flex-1 px-4 py-3 rounded-lg font-semibold text-slate-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    actionModal.type === 'entrada' 
                      ? 'bg-sky-500 hover:bg-sky-400 shadow-sm shadow-sky-500/20' 
                      : 'bg-rose-500 hover:bg-rose-400 shadow-sm shadow-rose-500/20'
                  }`}
                >
                  {isSubmitting ? 'Salvando...' : `Confirmar ${actionModal.type === 'entrada' ? 'Entrada' : 'Saída'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: Adicionar/Editar Compra */}
      {isCompraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/80 flex-shrink-0">
              <h2 className="text-lg font-semibold text-slate-200">{editingCompra ? 'Editar Sugestão' : 'Nova Sugestão de Compra'}</h2>
              <button 
                onClick={() => setIsCompraModalOpen(false)} 
                className="text-slate-400 hover:text-slate-200 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const nome = String(formData.get('nome'));
              const quantidade = Number(formData.get('quantidade'));
              const status = String(formData.get('status')) as 'Pendente' | 'Pedido Feito' | 'Entregue';

              if (editingCompra) {
                setCompras(prev => prev.map(c => c.id === editingCompra.id ? { ...c, nome, quantidade, status } : c));
                toast.success('Sugestão atualizada!');
              } else {
                setCompras(prev => [...prev, {
                  id: crypto.randomUUID(),
                  nome,
                  quantidade,
                  status
                }]);
                toast.success('Sugestão adicionada!');
              }
              setIsCompraModalOpen(false);
            }} className="p-6">
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5" htmlFor="nome_compra">
                    Nome do Produto
                  </label>
                  <input
                    id="nome_compra"
                    name="nome"
                    required
                    defaultValue={editingCompra ? editingCompra.nome : ''}
                    placeholder="Ex: Teclado Preto USB"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-medium placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5" htmlFor="quantidade_compra">
                    Quantidade Sugerida
                  </label>
                  <input
                    id="quantidade_compra"
                    name="quantidade"
                    type="number"
                    min="1"
                    required
                    defaultValue={editingCompra ? editingCompra.quantidade : 1}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-medium font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5" htmlFor="status_compra">
                    Status
                  </label>
                  <select 
                    id="status_compra"
                    name="status"
                    required
                    defaultValue={editingCompra ? editingCompra.status : 'Pendente'}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-medium appearance-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Pedido Feito">Pedido Feito</option>
                    <option value="Entregue">Entregue</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCompraModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 px-4 rounded-lg transition-colors border border-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <Save size={18} />
                  <span>{editingCompra ? 'Salvar Alterações' : 'Adicionar Sugestão'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
