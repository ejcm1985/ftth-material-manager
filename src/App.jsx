import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import { Download, PlusCircle, ArrowLeft, Loader2, FileSpreadsheet, Trash2, Scale, Search, LayoutDashboard, Zap, Scissors, Network } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('list');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projects, setProjects] = useState([]);

  useEffect(() => { fetchProjects(); }, []);

  async function fetchProjects() {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    setProjects(data || []);
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {view === 'list' && <ProjectList projects={projects} onSelect={(id) => { setSelectedProjectId(id); setView('edit'); }} onCreate={() => setView('create')} onRefresh={fetchProjects} />}
      {view === 'create' && <CreateProject onBack={() => setView('list')} onCreated={() => { fetchProjects(); setView('list'); }} />}
      {view === 'edit' && <ProjectEditor projectId={selectedProjectId} onBack={() => setView('list')} />}
    </div>
  );
}

// --- COMPONENTE: LISTA DE PROYECTOS ---
function ProjectList({ projects, onSelect, onCreate, onRefresh }) {
  async function deleteProject(id, name) {
    if (window.confirm(`¿Eliminar proyecto "${name}"?`)) {
      await supabase.from('projects').delete().eq('id', id);
      onRefresh();
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-blue-900 uppercase">Proyectos FTTH</h1>
          <p className="text-gray-500 text-sm font-medium">Gestión de Inventario y Capacidad Óptica</p>
        </div>
        <button onClick={onCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all font-bold">
          <PlusCircle size={20} /> Nuevo Proyecto
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map(p => (
          <div key={p.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
            <div onClick={() => onSelect(p.id)} className="cursor-pointer">
              <h3 className="font-bold text-xl text-gray-800 group-hover:text-blue-600 mb-2">{p.name}</h3>
              <div className="space-y-1 text-sm text-gray-500 font-medium">
                <p>📍 {p.city} | 👷 {p.engineer}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t flex justify-end">
              <button onClick={() => deleteProject(p.id, p.name)} className="p-2 text-red-400 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- COMPONENTE: CREAR PROYECTO ---
function CreateProject({ onBack, onCreated }) {
  const [form, setForm] = useState({ name: '', project_number: '', city: '', engineer: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const { data: project } = await supabase.from('projects').insert([form]).select().single();
    const { data: catalog } = await supabase.from('catalog_items').select('id');
    const initialItems = catalog.map(item => ({ project_id: project.id, catalog_item_id: item.id, quantity: 0 }));
    await supabase.from('project_materials').insert(initialItems);
    setLoading(false);
    onCreated();
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <button onClick={onBack} className="mb-6 flex items-center text-blue-600 font-bold hover:underline"><ArrowLeft size={18} className="mr-1"/> Volver</button>
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-xl grid gap-5 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800">Configurar Proyecto</h2>
        <input placeholder="Nombre del Proyecto" className="border-2 p-3 rounded-xl focus:border-blue-500 outline-none" onChange={e => setForm({...form, name: e.target.value})} required />
        <input placeholder="Código de Proyecto" className="border-2 p-3 rounded-xl focus:border-blue-500 outline-none" onChange={e => setForm({...form, project_number: e.target.value})} required />
        <input placeholder="Ciudad" className="border-2 p-3 rounded-xl focus:border-blue-500 outline-none" onChange={e => setForm({...form, city: e.target.value})} required />
        <input placeholder="Ingeniero Responsable" className="border-2 p-3 rounded-xl focus:border-blue-500 outline-none" onChange={e => setForm({...form, engineer: e.target.value})} required />
        <button type="submit" disabled={loading} className="bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 flex justify-center items-center gap-2">
          {loading ? <Loader2 className="animate-spin" /> : "Crear e Inicializar"}
        </button>
      </form>
    </div>
  );
}

// --- COMPONENTE: EDITOR, BUSCADOR Y DASHBOARD ---
function ProjectEditor({ projectId, onBack }) {
  const [materials, setMaterials] = useState([]);
  const [project, setProject] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [compareData, setCompareData] = useState(null);

  useEffect(() => { loadData(); }, [projectId]);

  async function loadData() {
    const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
    setProject(proj);
    const { data: items } = await supabase.from('catalog_items').select(`id, code, description, project_materials(quantity, updated_at)`).eq('project_materials.project_id', projectId);
    setMaterials(items.map(i => ({ 
      id: i.id, code: i.code, desc: i.description, 
      qty: i.project_materials[0]?.quantity || 0,
      updated_at: i.project_materials[0]?.updated_at 
    })));
  }

  // --- LÓGICA DEL DASHBOARD ---
  const getQty = (code) => materials.find(m => m.code === code)?.qty || 0;
  
  const hilosUtilizados = getQty('3502002') + getQty('3502008');
  const totalSplices = getQty('1404091');
  
  // Lógica Puertos: (Splitter 1:4 * 4 teóricos * 16 puertos) - (Splitter 1:16 usados * 16 puertos)
  const theoretical116 = getQty('3502002') * 4;
  const used116 = getQty('3502035');
  const availablePorts = (theoretical116 - used116) * 16;

  // --- FILTRADO DE MATERIALES ---
  const filteredMaterials = materials.filter(m => 
    m.code.includes(searchTerm) || 
    m.desc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleImportExcel = (e, isComparison = false) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]);
      const processed = data.map(row => {
        let code = String(row.Código || row.codigo || row.Code || '');
        if (code === '3502015') code = '3502015-FDT';
        return { code, qty: parseInt(row.Cantidad || row.cantidad || 0) };
      });

      if (isComparison) {
        setCompareData(processed);
      } else {
        for (const item of processed) {
          const match = materials.find(m => m.code === item.code);
          if (match) await updateQty(match.id, item.qty);
        }
        await loadData();
        alert("Importación exitosa");
      }
    };
    reader.readAsBinaryString(file);
  };

  async function updateQty(itemId, val) {
    const qty = parseInt(val) || 0;
    await supabase.from('project_materials').upsert({ project_id: projectId, catalog_item_id: itemId, quantity: qty, updated_at: new Date().toISOString() }, { onConflict: 'project_id, catalog_item_id' });
    setMaterials(prev => prev.map(m => m.id === itemId ? {...m, qty: qty, updated_at: new Date().toISOString()} : m));
  }

  function exportExcel() {
    let toExport = materials;
    if (dateFilter) toExport = materials.filter(m => m.updated_at && new Date(m.updated_at).toISOString().split('T')[0] === dateFilter);
    const ws = XLSX.utils.json_to_sheet(toExport.map(m => ({ Código: m.code, Descripción: m.desc, Cantidad: m.qty })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BOM");
    XLSX.writeFile(wb, `BOM_${project.name}.xlsx`);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* CABECERA */}
      <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
        <div>
          <button onClick={onBack} className="flex items-center text-blue-600 mb-2 font-bold hover:underline"><ArrowLeft size={18} className="mr-1"/> Volver</button>
          <h2 className="text-3xl font-bold text-gray-900 uppercase">{project?.name}</h2>
          <p className="text-gray-500 font-medium">Ing. {project?.engineer} | {project?.city}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-bold cursor-pointer shadow-md flex items-center gap-2 transition-all">
            <FileSpreadsheet size={20}/> Importar
            <input type="file" className="hidden" onChange={(e) => handleImportExcel(e, false)} accept=".xlsx, .xls" />
          </label>
          <label className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold cursor-pointer shadow-md flex items-center gap-2 transition-all">
            <Scale size={20}/> Comparar
            <input type="file" className="hidden" onChange={(e) => handleImportExcel(e, true)} accept=".xlsx, .xls" />
          </label>
          <div className="flex items-center bg-white border-2 border-gray-100 rounded-xl p-1 shadow-sm">
            <input type="date" className="p-2 text-sm outline-none" onChange={(e) => setDateFilter(e.target.value)} />
            <button onClick={exportExcel} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg flex items-center gap-2 font-bold transition-all">
              <Download size={20}/> Exportar
            </button>
          </div>
        </div>
      </div>

      {/* DASHBOARD DE INGENIERÍA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-blue-500 flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-full text-blue-600"><Zap size={24}/></div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Hilos Utilizados (Feeder)</p>
            <h4 className="text-2xl font-black text-blue-900">{hilosUtilizados} <span className="text-sm font-normal text-gray-400">/ 144</span></h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-orange-500 flex items-center gap-4">
          <div className="bg-orange-50 p-3 rounded-full text-orange-600"><Scissors size={24}/></div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Splices (SC-APC)</p>
            <h4 className="text-2xl font-black text-orange-900">{totalSplices}</h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-green-500 flex items-center gap-4">
          <div className="bg-green-50 p-3 rounded-full text-green-600"><Network size={24}/></div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Puertos Disponibles 2do Nivel</p>
            <h4 className="text-2xl font-black text-green-900">{availablePorts}</h4>
          </div>
        </div>
      </div>

      {/* BUSCADOR */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por código o descripción de material..." 
          className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm focus:border-blue-500 outline-none transition-all font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* SECCIÓN COMPARACIÓN */}
      {compareData && (
        <div className="mb-8 bg-purple-50 p-6 rounded-2xl border-2 border-purple-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2"><Scale size={20}/> Comparación de Materiales</h3>
            <button onClick={() => setCompareData(null)} className="text-purple-600 font-bold text-sm hover:underline">Cerrar</button>
          </div>
          <div className="bg-white rounded-xl overflow-hidden border border-purple-100">
            <table className="w-full text-sm">
              <thead className="bg-purple-100 text-purple-900">
                <tr><th className="p-3 text-left">Código</th><th className="p-3 text-center">Proyecto</th><th className="p-3 text-center">Excel</th><th className="p-3 text-center">Diferencia</th></tr>
              </thead>
              <tbody>
                {materials.map(m => {
                  const excel = compareData.find(e => e.code === m.code);
                  const excelQty = excel ? excel.qty : 0;
                  const diff = excelQty - m.qty;
                  if (excelQty === 0 && m.qty === 0) return null;
                  return (
                    <tr key={m.id} className="border-b border-purple-50">
                      <td className="p-3 font-mono font-bold">{m.code}</td>
                      <td className="p-3 text-center font-bold">{m.qty}</td>
                      <td className="p-3 text-center font-bold text-purple-600">{excelQty}</td>
                      <td className={`p-3 text-center font-black ${diff !== 0 ? 'text-red-600 bg-red-50' : 'text-green-600'}`}>{diff > 0 ? `+${diff}` : diff}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABLA PRINCIPAL */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-blue-900 text-white">
            <tr><th className="p-4 font-semibold">Código</th><th className="p-4 font-semibold">Descripción Técnica</th><th className="p-4 font-semibold text-center w-32">Cantidad</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredMaterials.map(m => (
              <tr key={m.id} className="hover:bg-blue-50/50 transition-colors">
                <td className="p-4 text-sm font-mono text-blue-700 font-bold">{m.code}</td>
                <td className="p-4 text-xs text-gray-700 uppercase leading-tight font-medium">{m.desc}</td>
                <td className="p-4"><input type="number" value={m.qty} onChange={e => updateQty(m.id, e.target.value)} className="w-full text-center border-2 border-gray-100 rounded-lg p-2 focus:border-blue-500 outline-none font-bold text-blue-900"/></td>
              </tr>
            ))}
            {filteredMaterials.length === 0 && (
              <tr><td colSpan="3" className="p-10 text-center text-gray-400 font-medium italic">No se encontraron materiales con ese criterio.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
