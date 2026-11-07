'use client'

import { useState } from 'react'
import { Camera, List, ChefHat, Loader2 } from 'lucide-react'
import { useInventory, InventoryItem } from '@/store/useInventory'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'scanner' | 'inventory' | 'chef'>('scanner')
  
  // Scanner State
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [detectedItems, setDetectedItems] = useState<InventoryItem[]>([])

  // Global Store
  const items = useInventory((state) => state.items)
  const addItem = useInventory((state) => state.addItem)

  // Camera Handler
  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setDetectedItems([]) // Reset previous detections
    }
  }

  // Vision API Call
  const handleAnalyze = async () => {
    if (!imageFile) return
    setIsAnalyzing(true)

    const formData = new FormData()
    formData.append('image', imageFile)

    try {
      const res = await fetch('/api/vision', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      
      if (data.items) {
        setDetectedItems(data.items)
        // Automatically add them to the global store for now
        data.items.forEach((item: InventoryItem) => addItem(item))
      }
    } catch (error) {
      console.error('Failed to analyze image', error)
      alert('Analysis failed. Check console.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const clearImage = () => {
    setImageFile(null)
    setPreviewUrl(null)
    setDetectedItems([])
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col relative overflow-hidden text-slate-900">
      
      <header className="pt-12 pb-4 px-6 bg-white border-b shadow-sm z-10">
        <h1 className="text-2xl font-bold tracking-tight text-emerald-600">Pantry Vision</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-24">
        
        {/* SCANNER TAB */}
        {activeTab === 'scanner' && (
          <div className="p-6 flex flex-col items-center h-full">
            {!previewUrl ? (
              <div className="flex-1 flex flex-col items-center justify-center w-full">
                <label className="bg-emerald-600 text-white rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer shadow-xl active:scale-95 transition-transform w-full aspect-square max-w-xs">
                  <Camera size={72} className="mb-4 opacity-90" />
                  <span className="text-2xl font-bold">Tap to Scan</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCapture}/>
                </label>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center">
                
                {/* Image & Bounding Boxes Container */}
                <div className="relative w-full rounded-2xl overflow-hidden shadow-md bg-black">
                  <img src={previewUrl} alt="Captured" className="w-full h-auto object-cover opacity-90" />
                  
                  {/* Render Bounding Boxes */}
                  {detectedItems.map((item, idx) => {
                    if (!item.box_2d) return null;
                    const [ymin, xmin, ymax, xmax] = item.box_2d;
                    return (
                      <div 
                        key={idx}
                        className="absolute border-2 border-emerald-400 bg-emerald-400/20 flex items-end justify-center cursor-pointer hover:bg-emerald-400/40 transition-colors"
                        style={{
                          top: `${(ymin / 1000) * 100}%`,
                          left: `${(xmin / 1000) * 100}%`,
                          height: `${((ymax - ymin) / 1000) * 100}%`,
                          width: `${((xmax - xmin) / 1000) * 100}%`,
                        }}
                      >
                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-1 py-0.5 rounded shadow-sm transform translate-y-full mt-1">
                          {item.name}
                        </span>
                      </div>
                    )
                  })}
                </div>
                
                <div className="flex gap-4 w-full mt-6">
                  <button onClick={clearImage} className="flex-1 bg-gray-200 text-gray-800 py-4 rounded-xl font-semibold active:bg-gray-300">
                    Retake
                  </button>
                  <button 
                    onClick={handleAnalyze} 
                    disabled={isAnalyzing}
                    className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-semibold shadow-md active:bg-emerald-700 flex justify-center items-center disabled:opacity-50"
                  >
                    {isAnalyzing ? <Loader2 className="animate-spin" /> : 'Analyze'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Your Inventory ({items.length})</h2>
            {items.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">Inventory empty.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {items.map((item, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-800">{item.name}</p>
                      {item.brand && <p className="text-xs text-gray-500">{item.brand}</p>}
                    </div>
                    <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{item.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CHEF TAB */}
        {activeTab === 'chef' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Chef Mode</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <p className="text-gray-400">Recipe UI goes here. (Wired to /api/recipes)</p>
            </div>
          </div>
        )}
      </div>

      <nav className="absolute bottom-0 w-full bg-white border-t border-gray-200 px-6 py-4 flex justify-between items-center z-20 pb-8">
        <button onClick={() => setActiveTab('scanner')} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeTab === 'scanner' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400'}`}>
          <Camera size={24} /><span className="text-xs font-medium mt-1">Scan</span>
        </button>
        <button onClick={() => setActiveTab('inventory')} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeTab === 'inventory' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400'}`}>
          <List size={24} /><span className="text-xs font-medium mt-1">Inventory</span>
        </button>
        <button onClick={() => setActiveTab('chef')} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeTab === 'chef' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400'}`}>
          <ChefHat size={24} /><span className="text-xs font-medium mt-1">Chef</span>
        </button>
      </nav>

    </main>
  )
}