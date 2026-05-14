function ProjectEditor({ projectId, onBack }) {
  const [materials, setMaterials] = useState([]);
  const [project, setProject] = useState(null);
  const [dateFilter, setDateFilter] = useState(''); // Estado para el filtro de fecha
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
    setProject(proj);
    
    // Traemos la cantidad Y la fecha de actualización de cada material
    const { data: items } = await supabase.from('catalog_items').select(`
      id, code, description, 
      project_materials(quantity, updated_at)
    `).eq('project_materials.project_id', projectId);
    
    setMaterials(items.map(i => ({ 
      id: i.id, 
      code: i.code, 
      desc: i.description, 
      qty: i.project_materials[0]?.quantity || 0,
      updated_at: i.project_materials[0]?.updated_at 
    })));
  }

  // --- FUNCIÓN PARA IMPORTAR EXCEL ---
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

      // Recorremos el Excel y actualizamos la base de datos
      for (const row of data) {
        // Buscamos el código en el Excel (soporta varias formas de escribirlo)
        const codeInExcel = row.Código || row.codigo || row.Code || row.CODE;
        const qtyInExcel = row.Cantidad || row.cantidad || row.Qty || row.QTY;
        
        const materialMatch = materials.find(m => String(m.code) === String(codeInExcel));
        
        if (materialMatch && qtyInExcel !== undefined) {
          await supabase.from('project_materials').upsert({ 
            project_id: projectId, 
            catalog_item_id: materialMatch.id, 
            quantity: parseInt(qtyInExcel) || 0,
            updated_at: new Date().toISOString() 
          }, { onConflict: 'project_id, catalog_item_id' });
        }
      }
      
      await loadData(); // Recargamos la tabla con los nuevos datos
      setIsImporting(false);
      alert("Importación exitosa. Se han actualizado las cantidades encontradas.");
    };
    reader.readAsBinaryString(file);
  };

  async function updateQty(itemId, val) {
    const qty = parseInt(val) || 0;
    await supabase.from('project_materials').upsert({ 
      project_id: projectId, 
      catalog_item_id: itemId, 
      quantity: qty,
      updated_at: new Date().toISOString() 
    }, { onConflict: 'project_id, catalog_item_id' });
    
    setMaterials(prev => prev.map(m => m.id === itemId ? {...m, qty: qty, updated_at: new Date().toISOString()} : m));
  }

  // --- FUNCIÓN PARA EXPORTAR CON FILTRO ---
  function exportExcel() {
    let dataToExport = materials;
    
    // Si el usuario eligió una fecha, filtramos
    if (dateFilter) {
      dataToExport = materials.filter(m => {
        if (!m.updated_at) return false;
        const itemDate = new Date(m.updated_at).toISOString().split('T')[0];
        return itemDate === dateFilter; // Filtra exactamente por ese día
      });
    }

    if (dataToExport.length === 0) {
      alert("No hay materiales modificados en la fecha seleccionada.");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport.map(m => ({
      Código: m.code,
      Descripción: m.desc,
      Cantidad: m.qty,
      'Fecha de Modificación': m.updated_at ? new Date(m.updated_at).toLocaleString() : 'N/A'
    })));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BOM_FTTH");
    XLSX.writeFile(wb, `BOM_${project.name}_${dateFilter || 'Completo'}.xlsx`);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <button onClick={onBack} className="flex items-center text-blue-600 mb-2 font-bold hover:underline">
            <ArrowLeft size={18} className="mr-1"/> Volver al listado
          </button>
          <h2 className="text-3xl font-bold text-gray-900">{project?.name}</h2>
          <p className="text-gray-500 font-medium">Ing. {project?.engineer} | {project?.city}</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {/* BOTÓN IMPORTAR */}
          <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold cursor-pointer transition-all shadow-md ${isImporting ? 'bg-gray-400' : 'bg-orange-500 hover:bg-orange-600'}`}>
            {isImporting ? <Loader2 className="animate-spin" size={20}/> : <PlusCircle size={20}/>}
            {isImporting ? 'Procesando...' : 'Importar Excel'}
            <input type="file" className="hidden" onChange={handleImportExcel} accept=".xlsx, .xls" disabled={isImporting} />
          </label>

          {/* FILTRO DE FECHA Y EXPORTAR */}
          <div className="flex items-center bg-white border-2 border-gray-100 rounded-xl p-1 shadow-sm">
            <input 
              type="date" 
              className="p-2 text-sm outline-none bg-transparent" 
              onChange={(e) => setDateFilter(e.target.value)}
              title="Filtrar por fecha de modificación"
            />
            <button 
              onClick={exportExcel} 
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg flex items-center gap-2 transition-all font-bold"
            >
              <Download size={20}/> {dateFilter ? 'Exportar Día' : 'Exportar Todo'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-blue-900 text-white">
            <tr>
              <th className="p-4 font-semibold">Código</th>
              <th className="p-4 font-semibold">Descripción Técnica</th>
              <th className="p-4 font-semibold text-center w-32">Cantidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {materials.map(m => (
              <tr key={m.id} className="hover:bg-blue-50/50 transition-colors">
                <td className="p-4 text-sm font-mono text-blue-700 font-bold">{m.code}</td>
                <td className="p-4 text-xs text-gray-700 uppercase leading-tight">{m.desc}</td>
                <td className="p-4">
                  <input 
                    type="number" 
                    value={m.qty} 
                    onChange={e => updateQty(m.id, e.target.value)} 
                    className="w-full text-center border-2 border-gray-100 rounded-lg p-2 focus:border-blue-500 outline-none transition-all font-bold text-blue-900"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
