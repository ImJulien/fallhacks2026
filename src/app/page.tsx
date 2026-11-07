'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Camera, List, ChefHat, Loader2, Upload, X, Circle, Moon, Sun } from 'lucide-react'
import { useInventory, InventoryItem } from '@/store/useInventory'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'scanner' | 'inventory' | 'chef'>('scanner')
  const [isDark, setIsDark] = useState(false)
  
  // Scanner State
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [detectedItems, setDetectedItems] = useState<InventoryItem[]>([])
  const [recipe, setRecipe] = useState<string | null>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isAddMoreOpen, setIsAddMoreOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const cameraModeRef = useRef<'append' | 'replace'>('append')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    setIsDark(window.localStorage.getItem('sous-theme') === 'dark')
  }, [])

  const toggleTheme = () => {
    setIsDark((current) => {
      const next = !current
      window.localStorage.setItem('sous-theme', next ? 'dark' : 'light')
      return next
    })
  }

  // Global Store
  const items = useInventory((state) => state.items)
  const addItem = useInventory((state) => state.addItem)

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) {
      setImageFiles((current) => [...current, ...files])
      setPreviewUrls((current) => [...current, ...files.map((file) => URL.createObjectURL(file))])
      setDetectedItems([])
      setRecipe(null)
    }
    e.target.value = ''
    setIsAddMoreOpen(false)
  }

  const addImage = (file: File) => {
    setImageFiles((current) => [...current, file])
    setPreviewUrls((current) => [...current, URL.createObjectURL(file)])
    setDetectedItems([])
    setRecipe(null)
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setIsCameraOpen(false)
  }

  const openCamera = async (mode: 'append' | 'replace' = 'append') => {
    cameraModeRef.current = mode
    setCameraError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not available in this browser.')
      setIsCameraOpen(true)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setIsCameraOpen(true)
    } catch (error) {
      console.error('Unable to access camera', error)
      setCameraError('Camera access was denied or unavailable.')
      setIsCameraOpen(true)
    }
  }

  useEffect(() => {
    if (isCameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [isCameraOpen])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const takePhoto = () => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `pantry-${Date.now()}.jpg`, { type: 'image/jpeg' })
      if (cameraModeRef.current === 'replace') {
        setImageFiles((current) => [...current.slice(0, -1), file])
        setPreviewUrls((current) => [...current.slice(0, -1), URL.createObjectURL(file)])
        setDetectedItems([])
        setRecipe(null)
      } else {
        addImage(file)
      }
      stopCamera()
    }, 'image/jpeg', 0.92)
  }

  // Vision API Call
  const handleAnalyze = async () => {
    if (imageFiles.length === 0) return
    setIsAnalyzing(true)

    const formData = new FormData()
    imageFiles.forEach((file) => formData.append('image', file))

    try {
      const res = await fetch('/api/vision', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      
      if (data.items) {
        setDetectedItems(data.items)
        data.items.forEach((item: InventoryItem) => addItem(item))

        const recipeResponse = await fetch('/api/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inventory: data.items, filters: [] }),
        })
        const recipeData = await recipeResponse.json()
        if (!recipeResponse.ok || !recipeData.recipe) {
          throw new Error(recipeData.error || 'Recipe generation failed')
        }
        setRecipe(recipeData.recipe)
      }
    } catch (error) {
      console.error('Failed to analyze image', error)
      alert(error instanceof Error ? error.message : 'Analysis failed. Check console.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const clearImage = () => {
    setImageFiles([])
    setPreviewUrls([])
    setDetectedItems([])
    setRecipe(null)
  }

  return (
    <main className={`mx-auto flex h-dvh w-full flex-col overflow-hidden shadow-2xl transition-colors duration-300 ${isDark ? 'bg-[#17201b] text-[#edf4ed] shadow-black/30' : 'bg-[#f6f7f2] text-[#1d2b24] shadow-[#274936]/15'}`}>
      <header className={`z-10 flex shrink-0 items-center justify-between border-b px-6 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] transition-colors duration-300 ${isDark ? 'border-white/10 bg-[#17201b]' : 'border-[#dfe6dc] bg-[#f6f7f2]'}`}>
        <span className={`text-lg font-semibold tracking-tight ${isDark ? 'text-[#a8e8b8]' : 'text-[#318f54]'}`}>sous.</span>
        <button type="button" onClick={toggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} className={`p-2 transition-all duration-200 hover:-translate-y-0.5 active:scale-90 ${isDark ? 'text-[#a8e8b8] hover:text-[#d4f7da]' : 'text-[#6d9877] hover:text-[#237c46]'}`}>
          {isDark ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </header>
      
      <div className="min-h-0 flex-1 overflow-hidden">
        
        {/* SCANNER TAB */}
        {activeTab === 'scanner' && (
          <div className="flex h-full flex-col items-center px-5 pb-4 pt-6">
            {previewUrls.length === 0 ? (
              <div className="flex w-full flex-1 items-center justify-center">
                <div className="flex w-full flex-col items-center gap-4">
                  <button type="button" onClick={() => openCamera()} className={`group flex w-full max-w-[360px] items-center justify-between border px-6 py-5 text-left transition-all duration-200 hover:-translate-y-1 active:translate-y-0 active:scale-[.99] ${isDark ? 'border-[#215a3a] bg-[#215a3a] text-white shadow-lg shadow-black/25 hover:bg-[#2b6f49]' : 'border-[#1f5d3d] bg-[#1f6b43] text-white shadow-lg shadow-[#1f5d3d]/20 hover:bg-[#28794d]'}`}>
                    <span>
                      <span className="block text-lg font-semibold">Take a picture</span>
                    </span>
                    <span className="flex h-14 w-14 items-center justify-center bg-white/15 transition-transform duration-200 group-hover:scale-105">
                      <Camera size={28} strokeWidth={1.7} />
                    </span>
                  </button>
                  <label className={`group flex w-full max-w-[360px] cursor-pointer items-center justify-between border px-6 py-5 text-left transition-all duration-200 hover:-translate-y-1 active:translate-y-0 active:scale-[.99] ${isDark ? 'border-[#44bb78] bg-[#44bb78] text-[#102719] hover:bg-[#55c987]' : 'border-[#b9d1be] bg-[#f7faf6] text-[#1f6b43] shadow-sm hover:bg-white'}`}>
                    <span>
                      <span className="block text-lg font-semibold">Upload a file</span>
                    </span>
                    <span className={`flex h-14 w-14 items-center justify-center transition-transform duration-200 group-hover:scale-105 ${isDark ? 'bg-black/10 text-[#102719]' : 'bg-[#e2f0e4] text-[#1f6b43]'}`}>
                      <Upload size={28} strokeWidth={1.7} />
                    </span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload}/>
                  </label>
                </div>
              </div>
            ) : (
              <div className="flex w-full flex-1 flex-col items-center">
                
                {/* Image & Bounding Boxes Container */}
                <div className={`min-h-0 w-full flex-1 overflow-hidden bg-black shadow-md ${previewUrls.length > 1 ? 'grid grid-cols-2 gap-2 p-2' : 'flex justify-center'}`}>
                  {previewUrls.map((url, index) => (
                    <img key={url} src={url} alt={`Selected ${index + 1}`} className={previewUrls.length === 1 ? 'h-full w-full object-cover opacity-90' : 'h-full min-h-0 w-full object-contain opacity-90'} />
                  ))}
                  
                  {/* Render Bounding Boxes */}
                  {previewUrls.length === 1 && detectedItems.map((item, idx) => {
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
                
                <div className="mt-5 grid w-full grid-cols-3 gap-2">
                  <button type="button" onClick={() => openCamera('replace')} className={`border px-2 py-4 text-center text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-[.98] ${isDark ? 'border-[#347a4b] bg-[#202b24] text-[#a8e8b8] hover:bg-[#2b392f]' : 'border-[#b9dfc2] bg-white text-[#318f54] hover:bg-[#e4f5e8]'}`}>
                    Retake image
                  </button>
                  <button type="button" onClick={() => setIsAddMoreOpen(true)} className={`border px-2 py-4 text-center text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-[.98] ${isDark ? 'border-[#347a4b] bg-[#202b24] text-[#a8e8b8] hover:bg-[#2b392f]' : 'border-[#b9dfc2] bg-white text-[#318f54] hover:bg-[#e4f5e8]'}`}>
                    Add more
                  </button>
                  <button 
                    onClick={handleAnalyze} 
                    disabled={isAnalyzing}
                    className={`flex flex-1 items-center justify-center border py-4 font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[.98] disabled:opacity-50 ${isDark ? 'border-[#347a4b] bg-[#205b35]' : 'border-[#247c46] bg-[#318f54]'}`}
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
          <div className="h-full overflow-hidden px-5 pb-4 pt-6">
            <h2 className="mb-2 text-2xl font-bold tracking-tight">Your Inventory</h2>
            <p className={`mb-5 text-sm ${isDark ? 'text-[#9caf9f]' : 'text-slate-500'}`}>{items.length} {items.length === 1 ? 'ingredient' : 'ingredients'} tracked</p>
            {items.length === 0 ? (
              <div className={`border border-dashed p-8 text-center text-sm ${isDark ? 'border-white/15 bg-[#202b24] text-[#9caf9f]' : 'border-slate-200 bg-white text-slate-400'}`}>No ingredients yet.</div>
            ) : (
              <div className="flex flex-col gap-3 overflow-hidden">
                {items.map((item, idx) => (
                  <div key={idx} className={`flex items-center justify-between border p-4 shadow-sm ${isDark ? 'border-white/10 bg-[#202b24]' : 'border-slate-200 bg-white'}`}>
                    <div>
                      <p className="font-bold">{item.name}</p>
                      {item.brand && <p className={`text-xs ${isDark ? 'text-[#9caf9f]' : 'text-gray-500'}`}>{item.brand}</p>}
                    </div>
                    <span className={`px-3 py-1 text-sm font-medium ${isDark ? 'bg-white/10 text-[#d5e5d7]' : 'bg-slate-100 text-slate-600'}`}>{item.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CHEF TAB */}
        {activeTab === 'chef' && (
          <div className="h-full px-5 pb-4 pt-6">
            <h2 className="mb-2 text-2xl font-bold tracking-tight">Chef Mode</h2>
            <p className={`mb-5 text-sm ${isDark ? 'text-[#9caf9f]' : 'text-slate-500'}`}>Recipes</p>
            <div className={`border p-8 text-center shadow-sm ${isDark ? 'border-white/10 bg-[#202b24]' : 'border-slate-200 bg-white'}`}>
              <ChefHat size={38} className={`mx-auto mb-4 ${isDark ? 'text-[#9caf9f]' : 'text-slate-400'}`} />
              {recipe ? <p className="whitespace-pre-wrap text-left text-sm leading-6">{recipe}</p> : <p className={`text-sm ${isDark ? 'text-[#9caf9f]' : 'text-slate-500'}`}>No recipes yet.</p>}
            </div>
          </div>
        )}
      </div>

      {isCameraOpen && (
        <div className="absolute inset-0 z-30 flex flex-col bg-black">
          <div className="flex items-center justify-between px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
            <button type="button" onClick={stopCamera} aria-label="Close camera" className="bg-white/10 p-2 text-white"><X size={20} /></button>
            <button type="button" onClick={takePhoto} aria-label="Take photo" disabled={!!cameraError} className="bg-white p-2 text-black disabled:opacity-40"><Circle size={34} fill="currentColor" strokeWidth={1.5} /></button>
          </div>
          {cameraError ? <p className="m-auto px-8 text-center text-sm text-zinc-300">{cameraError}</p> : <video ref={videoRef} autoPlay playsInline muted className="min-h-0 flex-1 object-cover" />}
        </div>
      )}
      {isAddMoreOpen && (
        <div className={`absolute inset-0 z-25 flex items-end ${isDark ? 'bg-black/60' : 'bg-[#1d2b24]/25'}`}>
          <div className={`w-full border-t p-5 ${isDark ? 'border-white/10 bg-[#202b24]' : 'border-[#dfe6dc] bg-white'}`}>
            <div className="mb-4 flex items-center justify-between">
              <span className="font-semibold">Add another image</span>
              <button type="button" onClick={() => setIsAddMoreOpen(false)} aria-label="Close add image options" className="p-1"><X size={19} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => { setIsAddMoreOpen(false); openCamera('append') }} className={`border py-4 font-semibold ${isDark ? 'border-[#347a4b] bg-[#215a3a] text-white' : 'border-[#1f5d3d] bg-[#1f6b43] text-white'}`}>
                Use camera
              </button>
              <label className={`flex cursor-pointer items-center justify-center border py-4 font-semibold ${isDark ? 'border-[#44bb78] bg-[#44bb78] text-[#102719]' : 'border-[#b9d1be] bg-[#f7faf6] text-[#1f6b43]'}`}>
                Upload files
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
              </label>
            </div>
          </div>
        </div>
      )}
      <nav className={`z-20 flex w-full shrink-0 items-center justify-around border-t px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 transition-colors duration-300 ${isDark ? 'border-white/10 bg-[#202b24]' : 'border-[#dfe6dc] bg-white'}`}>
        <button onClick={() => setActiveTab('scanner')} aria-label="Scan" className={`flex flex-col items-center gap-1 p-2 transition-all duration-200 hover:-translate-y-0.5 active:scale-90 ${activeTab === 'scanner' ? (isDark ? 'text-[#a8e8b8]' : 'text-[#318f54]') : isDark ? 'text-[#809388]' : 'text-[#9aa69c]'}`}>
          <Camera size={22} />
        </button>
        <button onClick={() => setActiveTab('inventory')} aria-label="Inventory" className={`flex flex-col items-center gap-1 p-2 transition-all duration-200 hover:-translate-y-0.5 active:scale-90 ${activeTab === 'inventory' ? (isDark ? 'text-[#a8e8b8]' : 'text-[#318f54]') : isDark ? 'text-[#809388]' : 'text-[#9aa69c]'}`}>
          <List size={22} />
        </button>
        <button onClick={() => setActiveTab('chef')} aria-label="Chef" className={`flex flex-col items-center gap-1 p-2 transition-all duration-200 hover:-translate-y-0.5 active:scale-90 ${activeTab === 'chef' ? (isDark ? 'text-[#a8e8b8]' : 'text-[#318f54]') : isDark ? 'text-[#809388]' : 'text-[#9aa69c]'}`}>
          <ChefHat size={22} />
        </button>
      </nav>

    </main>
  )
}