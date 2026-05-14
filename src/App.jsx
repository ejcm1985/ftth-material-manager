import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import { Download, PlusCircle, ArrowLeft, Loader2, FileSpreadsheet } from 'lucide-react';

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
      {view === 'list' && <ProjectList projects={projects} onSelect={(id) => { setSelectedProjectId(id); setView('edit'); }} onCreate={() => setView('create')} />}
      {view === 'create' && <CreateProject onBack={() => setView('list')} onCreated={() => { fetchProjects(); setView('list'); }} />}
      {view === 'edit' && <ProjectEditor projectId={selectedProjectId} onBack={() => setView('list')} />}
    </div>
  );
}

// --- COMPONENTE: LISTA DE PROYECTOS ---
function ProjectList({ projects, onSelect, onCreate }) {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-blue-900">Proyectos FTTH</h1>
          <p className="text-gray-500 text-sm font-medium">Gestión de materiales y BOM por proyecto</p>
        </div>
        <button onClick={onCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all font-bold">
          <PlusCircle size={20} /> Nuevo Proyecto
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.length === 0 && <p className="text-gray-400 col-span-full text-center py-10">No hay proyectos creados aún.</p>}
        {projects.map(p => (
          <div key={p.id} onClick={() => onSelect(p.id)} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group">
            <h3 className="font-bold text-xl text-gray-800 group-hover:text-blue-600 mb-2">{p.name}</h3>
            <div className="space-y-1 text-sm text-gray-500 font-medium">
              <p>📍 {p.city}</p>
              <p>👷 {p.engineer}</p>
              <p>🔢 {p.project_number}</p>
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
    try {
      const { data: project, error: pError } = await supabase.from('projects').insert([form]).select().single();
      if (pError) throw pError;
      
      const { data: catalog } = await supabase.from('catalog_items').select('id');
      const initialItems = catalog.map(item => ({ project_id: project.id, catalog_item_id: item.id, quantity: 0 }));
      await supabase.from('project_materials').insert(initialItems);
      onCreated();
    } catch (err) {
      alert("Error al crear: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <button onClick={onBack} className="mb-6 flex items-center text-blue-600 font-bold hover:underline"><ArrowLeft size={18} className="mr-1"/> Volver al listado</button>
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-xl grid gap-5 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Configurar Proyecto</h2>
        <input placeholder="Nombre del Proyecto (Ej: Nodo Sur)" className="border-2 p-3 rounded-xl focus:border-blue-500 outline-none" onChange={e => setForm({...form, name: e.target.value})} required />
        <input placeholder="Código de Proyecto" className="border-2 p-3 rounded-xl focus:border-blue-500 outline-none" onChange={e => setForm({...form, project_number: e.target.value})} required />
        <input placeholder="Ciudad" className="border-2 p-3 rounded-xl focus:border-blue-500 outline-none" onChange={e => setForm({...form, city: e.target.value})} required />
        <input placeholder="Ingeniero Responsable" className="border-2 p-3 rounded-xl focus:border-blue-500 outline-none" onChange={e => setForm({...form, engineer: e.target.value})} required />
        <button type="submit" disabled={loading} className="bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors flex justify-center items-center gap-2">
          {loading ? <Loader2 className="animate-spin" /> : "Crear e Inicializar Materiales"}
        </button>
      </form>
    </div>
  );
}

// --- COMPONENTE: EDITOR DE PROYECTO (CON IMPORT/EXPORT) ---
function ProjectEditor({ projectId, onBack }) {
  const [materials, setMaterials] = useState([]);
  const [project, setProject] = useState(null);
  const [dateFilter, setDateFilter] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => { loadData(); }, [projectId]);

  async function loadData() {
    const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
    setProject(proj);
    const { data: items } = await supabase.from('catalog_items').select(`id, code, description, project_materials(quantity, updated_at)`).eq('project_materials.project_id', projectId);
    setMaterials(items.map(i => ({ 
      id: i.id, 
      code: i.code, 
      desc: i.description, 
      qty: i.project_materials[0]?.quantity || 0,
      updated_at: i.project_materials[0]?.updated_at 
    })));
  }

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      for (const row of data) {
        const codeInExcel = row.Código || row.codigo || row.Code || row.CODE;
        const qtyInExcel = row.Cantidad || row.cantidad || row.Qty || row.QTY;
        const match = materials.find(m => String(m.code) === String(codeInExcel));
        if (match && qtyInExcel !== undefined) {
          await supabase.from('project_materials').upsert({ project_id: projectId, catalog_item_id: match.id, quantity: parseInt(qtyInExcel) || 0, updated_at: new Date().toISOString() }, { onConflict: 'project_id, catalog_item_id' });
        }
      }
      await loadData();
      setIsImporting(false);
      alert("Importación completada.");
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
    if (dateFilter) {
      toExport = materials.filter(m => m.updated_at && new Date(m.updated_at).toISOString().split('T')[0] === dateFilter);
    }
    if (toExport.length === 0) return alert("Sin datos para esta fecha.");
    const ws = XLSX.utils.json_to_sheet(toExport.map(m => ({ Código: m.code, Descripción: m.desc, Cantidad: m.qty, Modificado: new Date(m.updated_at).toLocaleString() })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BOM");
    XLSX.writeFile(wb, `BOM_${project.name}_${dateFilter || 'TOTAL'}.xlsx`);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
        <div>
          <button onClick={onBack} className="flex items-center text-blue-600 mb-2 font-bold hover:underline"><ArrowLeft size={18} className="mr-1"/> Volver</button>
          <h2 className="text-3xl font-bold text-gray-900">{project?.name}</h2>
          <p className="text-gray-500 font-medium">Ing. {project?.engineer} | {project?.city}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold cursor-pointer shadow-md transition-all ${isImporting ? 'bg-gray-400' : 'bg-orange-500 hover:bg-orange-600'}`}>
            {isImporting ? <Loader2 className="animate-spin" size={20}/> : <FileSpreadsheet size={20}/>}
            {isImporting ? 'Procesando...' : 'Importar Excel'}
            <input type="file" className="hidden" onChange={handleImportExcel} accept=".xlsx, .xls" disabled={isImporting} />
          </label>
          <div className="flex items-center bg-white border-2 border-gray-100 rounded-xl p-1 shadow-sm">
            <input type="date" className="p-2 text-sm outline-none bg-transparent" onChange={(e) => setDateFilter(e.target.value)} />
            <button onClick={exportExcel} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg flex items-center gap-2 transition-all font-bold">
              <Download size={20}/> {dateFilter ? 'Exportar Día' : 'Exportar Todo'}
            </button>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-blue-900 text-white">
            <tr><th className="p-4 font-semibold">Código</th><th className="p-4 font-semibold">Descripción Técnica</th><th className="p-4 font-semibold text-center w-32">Cantidad</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {materials.map(m => (
              <tr key={m.id} className="hover:bg-blue-50/50 transition-colors">
                <td className="p-4 text-sm font-mono text-blue-700 font-bold">{m.code}</td>
                <td className="p-4 text-xs text-gray-700 uppercase leading-tight font-medium">{m.desc}</td>
                <td className="p-4"><input type="number" value={m.qty} onChange={e => updateQty(m.id, e.target.value)} className="w-full text-center border-2 border-gray-100 rounded-lg p-2 focus:border-blue-500 outline-none font-bold text-blue-900"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
