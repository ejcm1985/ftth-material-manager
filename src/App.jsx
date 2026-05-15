import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import { Download, PlusCircle, ArrowLeft, Loader2, FileSpreadsheet, Trash2, Scale, Search, Zap, Scissors, Network, Edit3, Filter, X, CheckCircle2 } from 'lucide-react';

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
      {view === 'edit' && <ProjectEditor projectId={selectedProjectId} onBack={() => setView('list')} onRefreshProjects={fetchProjects} />}
    </div>
  );
}

// --- COMPONENTE: LISTA DE PROYECTOS CON BUSCADOR ---
function ProjectList({ projects, onSelect, onCreate, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.engineer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  async function deleteProject(id, name) {
    if (window.confirm(`¿Eliminar proyecto "${name}"?`)) {
      await supabase.from('projects').delete().eq('id', id);
      onRefresh();
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-blue-900 uppercase tracking-tighter">Proyectos FTTH</h1>
          <p className="text-gray-500 text-sm font-medium">Inventario y Control de Redes Ópticas</p>
        </div>
        <button onClick={onCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 shadow-lg transition-all font-bold">
          <PlusCircle size={20} /> Nuevo Proyecto
        </button>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar proyecto por nombre, ciudad o ingeniero..." 
          className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm focus:border-blue-500 outline-none transition-all font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map(p => (
          <div key={p.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group relative">
            <div onClick={() => onSelect(p.id)} className="cursor-pointer">
              <h3 className="font-bold text-xl text-gray-800 group-hover:text-blue-600 mb-2">{p.name}</h3>
              <div className="space-y-1 text-sm text-gray-500 font-medium">
                <p>📍 {p.city}</p>
                <p>👷 {p.engineer}</p>
                <p>🔢 {p.project_number}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t flex justify-end">
              <button onClick={() => deleteProject(p.id, p.name)} className="p-2 text-red-300 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
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
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl shadow-xl grid gap-5 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800">Nuevo Proyecto</h2>
        <input placeholder="Nombre del Proyecto" className="border-2 p-3 rounded-xl focus:border-blue-500 outline-none" onChange={e => setForm({...form, name: e.target.value})} required />
        <input placeholder="Código de Proyecto" className="border-2 p-3 rounded-xl focus:border-blue-500 outline-none" onChange={e => setForm({...form, project_number: e.target.value})} required />
        <input placeholder="Ciudad" className="border-2 p-3 rounded-xl focus:border-blue-500 outline-none" onChange={e => setForm({...form, city: e.target.value})} required />
        <input placeholder="Ingeniero Responsable" className="border-2 p-3 rounded-xl focus:border-blue-500 outline-none" onChange={e => setForm({...form, engineer: e.target.value})} required />
        <button type="submit" disabled={loading} className="bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 flex justify-center items-center gap-2 transition-all">
          {loading ? <Loader2 className="animate-spin" /> : "Crear e Inicializar"}
        </button>
      </form>
    </div>
  );
}

// --- COMPONENTE: EDITOR, DASHBOARD Y ESCÁNER UNIVERSAL ---
function ProjectEditor({ projectId, onBack, onRefreshProjects }) {
  const [materials, setMaterials] = useState([]);
  const [project, setProject] = useState(null);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hideZeros, setHideZeros] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
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

  async function updateProjectInfo(e) {
    e.preventDefault();
    await supabase.from('projects').update({
      name: project.name,
      project_number: project.project_number,
      city: project.city,
      engineer: project.engineer
    }).eq('id', projectId);
    setIsEditingInfo(false);
    onRefreshProjects();
  }

  // --- LÓGICA DE ESCÁNER UNIVERSAL (PARA IMPORTAR Y COMPARAR) ---
  const handleUniversalScanner = (e, isComparison = false) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      const processed = [];
      const catalogCodes = materials.map(m => String(m.code));

      rows.forEach((row) => {
        let foundCode = null;
        let foundQty = null;

        // Buscar código en la fila
        row.forEach((cellValue) => {
          let cleanValue = String(cellValue || '').trim();
          if (cleanValue === '3502015') cleanValue = '3502015-FDT';
          if (catalogCodes.includes(cleanValue)) foundCode = cleanValue;
        });

        // Si hay código, buscar el primer número en la fila
        if (foundCode) {
          row.forEach((cellValue) => {
            if (typeof cellValue === 'number' && String(cellValue) !== foundCode) {
              foundQty = cellValue;
            }
          });
          if (foundQty !== null) processed.push({ code: foundCode, qty: foundQty });
        }
      });

      if (processed.length === 0) return alert("No se detectaron códigos válidos en el archivo.");

      if (isComparison) {
        setCompareData(processed);
      } else {
        setIsImporting(true);
        for (const item of processed) {
          const match = materials.find(m => m.code === item.code);
          if (match) await updateQty(match.id, item.qty);
        }
        await loadData();
        setIsImporting(false);
        alert(`Escaneo exitoso: ${processed.length} materiales actualizados.`);
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
    const nonZeroMaterials = materials.filter(m => m.qty > 0);
    const header = [
      ["REPORTE TÉCNICO DE MATERIALES FTTH"],
      ["PROYECTO:", project.name],
      ["CÓDIGO:", project.project_number],
      ["CIUDAD:", project.city],
      ["INGENIERO:", project.engineer],
      ["FECHA:", new Date().toLocaleDateString()],
      [],
      ["CÓDIGO", "DESCRIPCIÓN", "CANTIDAD"]
    ];
    const dataRows = nonZeroMaterials.map(m => [m.code, m.desc, m.qty]);
    const ws = XLSX.utils.aoa_to_sheet(header.concat(dataRows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BOM");
    XLSX.writeFile(wb, `BOM_${project.name}.xlsx`);
  }

  // Dashboard logic
  const getQty = (code) => materials.find(m => m.code === code)?.qty || 0;
  const hilosUtilizados = getQty('3502002') + getQty('3502008');
  const availablePorts = (getQty('3502002') * 4 - getQty('3502035')) * 16;

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.code.includes(searchTerm) || m.desc.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesHideZero = hideZeros ? m.qty > 0 : true;
    return matchesSearch && matchesHideZero;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-6">
        <div className="w-full md:w-auto">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-2 font-bold hover:underline"><ArrowLeft size={18} className="mr-1"/> Volver</button>
          {isEditingInfo ? (
            <form onSubmit={updateProjectInfo} className="bg-white p-4 rounded-2xl border shadow-sm space-y-3">
              <input value={project.name} className="border p-2 w-full rounded" onChange={e => setProject({...project, name: e.target.value})} />
              <div className="flex gap-2">
                <input value={project.city} className="border p-2 w-1/2 rounded" onChange={e => setProject({...project, city: e.target.value})} />
                <input value={project.engineer} className="border p-2 w-1/2 rounded" onChange={e => setProject({...project, engineer: e.target.value})} />
              </div>
              <button type="submit" className="bg-blue-600 text-white px-4 py-1 rounded font-bold">Guardar</button>
            </form>
          ) : (
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-3xl font-black text-gray-900 uppercase">{project?.name}</h2>
                <p className="text-gray-500 font-medium">{project?.city} | {project?.engineer}</p>
              </div>
              <button onClick={() => setIsEditingInfo(true)} className="p-2 bg-gray-100 rounded-full text-gray-400 hover:text-blue-600 transition-colors"><Edit3 size={18}/></button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-2xl font-bold cursor-pointer shadow-md flex items-center gap-2 transition-all">
            <FileSpreadsheet size={20}/> Importar Excel
            <input type="file" className="hidden" onChange={(e) => handleUniversalScanner(e, false)} accept=".xlsx, .xls" />
          </label>
          <label className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-2xl font-bold cursor-pointer shadow-md flex items-center gap-2 transition-all">
            <Scale size={20}/> Comparar Excel
            <input type="file" className="hidden" onChange={(e) => handleUniversalScanner(e, true)} accept=".xlsx, .xls" />
          </label>
          <button onClick={exportExcel} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-2xl flex items-center gap-2 font-bold shadow-md transition-all">
            <Download size={20}/> Exportar BOM
          </button>
        </div>
      </div>

      {/* DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl shadow-sm border-l-8 border-blue-500">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Hilos Feeder Utilizados</p>
          <h4 className="text-2xl font-black text-blue-900">{hilosUtilizados} <span className="text-sm font-normal text-gray-300">/ 144</span></h4>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border-l-8 border-green-500">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Puertos Libres 2do Nivel</p>
          <h4 className="text-2xl font-black text-green-900">{availablePorts}</h4>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border-l-8 border-orange-500">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Splices SC-APC</p>
          <h4 className="text-2xl font-black text-orange-900">{getQty('1404091')}</h4>
        </div>
      </div>

      {/* BUSCADOR Y FILTROS */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar material por código o nombre..." 
            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm focus:border-blue-500 outline-none transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setHideZeros(!hideZeros)}
          className={`px-6 py-4 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-sm border-2 ${hideZeros ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-100 hover:border-blue-200'}`}
        >
          <Filter size={20}/> {hideZeros ? "Mostrando solo con cantidad" : "Filtrar ceros"}
        </button>
      </div>

      {/* COMPARACIÓN */}
      {compareData && (
        <div className="mb-8 bg-purple-50 p-6 rounded-3xl border-2 border-purple-100 relative">
          <button onClick={() => setCompareData(null)} className="absolute top-4 right-4 text-purple-400 hover:text-red-500"><X/></button>
          <h3 className="text-lg font-bold text-purple-900 mb-4 flex items-center gap-2"><Scale size={20}/> Comparación Universal de Cantidades</h3>
          <div className="bg-white rounded-2xl overflow-hidden border border-purple-100">
            <table className="w-full text-sm">
              <thead className="bg-purple-100 text-purple-900">
                <tr><th className="p-3 text-left">Código</th><th className="p-3 text-center">En Proyecto</th><th className="p-3 text-center">En Excel</th><th className="p-3 text-center">Diferencia</th></tr>
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
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-blue-900 text-white">
            <tr><th className="p-5 font-semibold">Código</th><th className="p-5 font-semibold">Descripción Técnica</th><th className="p-5 font-semibold text-center w-36">Cantidad</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredMaterials.map(m => (
              <tr key={m.id} className="hover:bg-blue-50/30 transition-colors">
                <td className="p-5 text-sm font-mono text-blue-700 font-bold">{m.code}</td>
                <td className="p-5 text-xs text-gray-700 uppercase leading-tight font-medium">{m.desc}</td>
                <td className="p-5"><input type="number" value={m.qty} onChange={e => updateQty(m.id, e.target.value)} className="w-full text-center border-2 border-gray-100 rounded-xl p-2 focus:border-blue-500 outline-none font-bold text-blue-900 transition-all"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
