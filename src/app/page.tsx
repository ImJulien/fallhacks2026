'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Camera, List, ChefHat, Loader2, Upload, X, Circle, Moon, Sun, Sparkles, Trash2, Edit2, Check, Clock, Flame, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { useInventory, InventoryItem } from '@/store/useInventory'

interface Recipe {
  title: string
  prepTime: string
  cookTime: string
  servings: string
  ingredients: string[]
  instructions: string[]
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'scanner' | 'inventory' | 'chef'>('scanner')
  const [isDark, setIsDark] = useState(false)
  
  // Scanner State
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [detectedItems, setDetectedItems] = useState<InventoryItem[]>([])
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sidekickConstraintsRef = useRef<HTMLDivElement>(null)

  // Recipe State
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false)
  const [isSidekickOpen, setIsSidekickOpen] = useState(false)
  const [recipeError, setRecipeError] = useState<string | null>(null)
  const [recipePreferences, setRecipePreferences] = useState<string[]>(['quick and easy'])

  const recipeOptions = [
    { label: 'Quick & easy', value: 'quick and easy' },
    { label: 'Comfort food', value: 'comfort food' },
    { label: 'High protein', value: 'high protein' },
    { label: 'Vegetarian', value: 'vegetarian' },
    { label: 'Budget-friendly', value: 'budget-friendly' },
  ]

  // Inventory Edit State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDetectedId, setEditingDetectedId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editQuantity, setEditQuantity] = useState('')

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

  const { items, addItem, removeItem, updateItem, clearInventory } = useInventory()

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) {
      setImageFiles(files)
      setPreviewUrls(files.map((file) => URL.createObjectURL(file)))
      setDetectedItems([])
    }
  }

  const addImage = (file: File) => {
    setImageFiles((current) => [...current, file])
    setPreviewUrls((current) => [...current, URL.createObjectURL(file)])
    setDetectedItems([])
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setIsCameraOpen(false)
  }

  const openCamera = async () => {
    setCameraError(null)
    setIsCameraOpen(true)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(window.isSecureContext
        ? 'Camera access is not available in this browser. You can upload a photo instead.'
        : 'Camera access requires HTTPS on mobile browsers. Use the upload option or open this app over HTTPS.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
    } catch (error) {
      console.error('Unable to access camera', error)
      const errorName = error instanceof DOMException ? error.name : ''
      setCameraError(errorName === 'NotAllowedError'
        ? window.isSecureContext
          ? 'Camera permission was denied or already blocked. Allow camera access in your browser settings, then try again.'
          : 'Your phone requires HTTPS before it will ask for camera permission. Use the upload option or open this app over HTTPS.'
        : 'Camera access is unavailable. Check your browser permissions or use the upload option.')
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
      addImage(file)
      stopCamera()
    }, 'image/jpeg', 0.92)
  }

  const handleAnalyze = async () => {
    if (imageFiles.length === 0) return
    setIsAnalyzing(true)

    const formData = new FormData()

    try {
      for (let i = 0; i < imageFiles.length; i++) {
        const img = new Image()
        img.src = previewUrls[i]
        
        await new Promise((resolve) => (img.onload = resolve))

        const MAX_SIZE = 2200
        let width = img.width
        let height = img.height
        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width
          width = MAX_SIZE
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height
          height = MAX_SIZE
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)

        const compressedBlob = await new Promise<Blob | null>((resolve) => 
          canvas.toBlob(resolve, 'image/jpeg', 0.98)
        )

        if (compressedBlob) {
          formData.append('image', compressedBlob, `scan-${i}.jpg`)
        }
      }

      const res = await fetch('/api/vision', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      
      if (data.items) {
        setDetectedItems(data.items)
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
    detectedItems.forEach((item) => removeItem(item.id))
    setImageFiles([])
    setPreviewUrls([])
    setDetectedItems([])
  }

  const cancelDetectedItems = () => {
    detectedItems.forEach((item) => removeItem(item.id))
    setDetectedItems([])
  }

  const startEditing = (item: InventoryItem) => {
    setEditingId(item.id)
    setEditName(item.name)
    setEditQuantity(item.quantity || '')
  }

  const startDetectedEditing = (item: InventoryItem) => {
    setEditingDetectedId(item.id)
    setEditName(item.name)
    setEditQuantity(item.quantity || '')
  }

  const saveEdit = (id: string) => {
    updateItem(id, { name: editName, quantity: editQuantity })
    setEditingId(null)
  }

  const saveDetectedEdit = (id: string) => {
    const currentItem = detectedItems.find((item) => item.id === id)
    if (!currentItem) return
    const updatedItem = { name: editName.trim() || currentItem.name, quantity: editQuantity.trim() }
    updateItem(id, updatedItem)
    setDetectedItems((current) => current.map((item) => (
      item.id === id ? { ...item, ...updatedItem } : item
    )))
    setEditingDetectedId(null)
  }

  const handleGenerateRecipe = async () => {
    if (items.length === 0) return
    setIsGeneratingRecipe(true)
    setRecipeError(null)
    
    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          inventory: items, 
          filters: recipePreferences
        }),
      })
      if (!res.ok) throw new Error('Recipe request failed')
      const data = await res.json()
      if (data.recipe) {
        setRecipe(data.recipe)
      } else {
        throw new Error('Recipe response was empty')
      }

    } catch (error) {
      console.error('Failed to generate recipe', error)
      setRecipeError('I couldn’t make that recipe right now. Try again in a moment.')
    } finally {
      setIsGeneratingRecipe(false)
    }

  }

  const toggleRecipePreference = (value: string) => {
    setRecipePreferences((current) => current.includes(value)
      ? current.filter((preference) => preference !== value)
      : [...current, value])
  }

  const toggleSidekick = () => {
    setIsSidekickOpen((open) => !open)
  }

  const sidekickTip = activeTab === 'scanner'
    ? items.length > 0
      ? 'I found ingredients in your inventory. Let me turn them into a recipe!'
      : 'Take a photo of your fridge or pantry, and I’ll help you spot ingredients.'
    : activeTab === 'inventory'
      ? 'You can edit an ingredient anytime. I’ll use your inventory to build recipes.'
      : recipe
        ? `Your ${recipe.title} is ready. I’m here if you need a cooking tip!`
        : 'Give me your ingredients and I’ll dream up something delicious.'

  return (
    <main className={`mx-auto flex h-dvh w-full flex-col overflow-hidden shadow-2xl transition-colors duration-300 ${isDark ? 'bg-[#17201b] text-[#edf4ed] shadow-black/30' : 'bg-[#f6f7f2] text-[#1d2b24] shadow-[#274936]/15'}`}>
      <header className={`z-10 flex shrink-0 items-center justify-between border-b px-6 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] transition-colors duration-300 ${isDark ? 'border-white/10 bg-[#17201b]' : 'border-[#dfe6dc] bg-[#f6f7f2]'}`}>
        <span className={`text-lg font-semibold tracking-tight ${isDark ? 'text-[#a8e8b8]' : 'text-[#318f54]'}`}>sous.</span>
        <button type="button" onClick={toggleTheme} className={`p-2 transition-all duration-200 hover:-translate-y-0.5 active:scale-90 ${isDark ? 'text-[#a8e8b8] hover:text-[#d4f7da]' : 'text-[#6d9877] hover:text-[#237c46]'}`}>
          {isDark ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </header>
      
      <div className="min-h-0 flex-1 overflow-y-auto">
        
        {/* SCANNER TAB */}
        {activeTab === 'scanner' && (
          <div className="flex h-full flex-col items-center px-5 pb-4 pt-6">
            {previewUrls.length === 0 ? (
              <div className="flex w-full flex-1 items-center justify-center">
                <div className="flex w-full flex-col items-center gap-4">
                  <button type="button" onClick={openCamera} className={`group flex w-full max-w-[360px] items-center justify-between border px-6 py-5 text-left transition-all duration-200 hover:-translate-y-1 active:translate-y-0 active:scale-[.99] rounded-2xl ${isDark ? 'border-[#215a3a] bg-[#215a3a] text-white shadow-lg shadow-black/25 hover:bg-[#2b6f49]' : 'border-[#1f5d3d] bg-[#1f6b43] text-white shadow-lg shadow-[#1f5d3d]/20 hover:bg-[#28794d]'}`}>
                    <span><span className="block text-lg font-semibold">Take a picture</span></span>
                    <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 transition-transform duration-200 group-hover:scale-105">
                      <Camera size={28} strokeWidth={1.7} />
                    </span>
                  </button>
                  <label className={`group flex w-full max-w-[360px] cursor-pointer items-center justify-between border px-6 py-5 text-left transition-all duration-200 hover:-translate-y-1 active:translate-y-0 active:scale-[.99] rounded-2xl ${isDark ? 'border-[#44bb78] bg-[#44bb78] text-[#102719] hover:bg-[#55c987]' : 'border-[#b9d1be] bg-[#f7faf6] text-[#1f6b43] shadow-sm hover:bg-white'}`}>
                    <span><span className="block text-lg font-semibold">Upload a file</span></span>
                    <span className={`flex h-14 w-14 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${isDark ? 'bg-black/10 text-[#102719]' : 'bg-[#e2f0e4] text-[#1f6b43]'}`}>
                      <Upload size={28} strokeWidth={1.7} />
                    </span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload}/>
                  </label>
                </div>
              </div>
            ) : (
              <div className="flex w-full flex-1 flex-col items-center">
                <div className={`relative min-h-0 w-full flex-1 overflow-hidden rounded-2xl bg-black shadow-md ${previewUrls.length > 1 ? 'grid grid-cols-2 gap-2 p-2' : 'flex justify-center'}`}>
                  {previewUrls.map((url, index) => (
                    <img key={url} src={url} alt={`Selected ${index + 1}`} className={previewUrls.length === 1 ? 'h-full w-full object-fill opacity-90' : 'h-full min-h-0 w-full object-contain opacity-90'} />
                  ))}
                  {previewUrls.length === 1 && detectedItems.map((item, idx) => {
                    if (!item.box_2d) return null;
                    const [ymin, xmin, ymax, xmax] = item.box_2d;
                    return (
                      <button type="button" key={item.id || idx} onClick={() => startDetectedEditing(item)} className="absolute border-2 border-emerald-400 bg-emerald-400/20 flex items-end justify-center cursor-pointer hover:bg-emerald-400/40 transition-colors rounded-sm"
                        style={{ top: `${(ymin / 1000) * 100}%`, left: `${(xmin / 1000) * 100}%`, height: `${((ymax - ymin) / 1000) * 100}%`, width: `${((xmax - xmin) / 1000) * 100}%` }}>
                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm transform translate-y-full mt-1 whitespace-nowrap">{item.name}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="mt-5 flex w-full gap-3">
                  {detectedItems.length > 0 && (
                    <button onClick={cancelDetectedItems} className={`flex-1 rounded-xl border py-4 font-semibold transition-all duration-200 active:scale-[.98] ${isDark ? 'border-red-900/50 bg-[#202b24] text-red-300 hover:bg-red-900/30' : 'border-red-200 bg-white text-red-500 hover:bg-red-50'}`}>Cancel</button>
                  )}
                  <button onClick={clearImage} className={`flex-1 rounded-xl border py-4 font-semibold transition-all duration-200 active:scale-[.98] ${isDark ? 'border-[#347a4b] bg-[#202b24] text-[#a8e8b8] hover:bg-[#2b392f]' : 'border-[#b9dfc2] bg-white text-[#318f54] hover:bg-[#e4f5e8]'}`}>Retake</button>
                  <button onClick={handleAnalyze} disabled={isAnalyzing} className={`flex flex-1 items-center justify-center rounded-xl border py-4 font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[.98] disabled:opacity-50 ${isDark ? 'border-[#347a4b] bg-[#205b35]' : 'border-[#247c46] bg-[#318f54]'}`}>
                    {isAnalyzing ? <Loader2 className="animate-spin" /> : 'Analyze'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div className="h-full overflow-y-auto px-5 pb-4 pt-6">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Your Inventory</h2>
                <p className={`text-sm mt-1 ${isDark ? 'text-[#9caf9f]' : 'text-slate-500'}`}>{items.length} {items.length === 1 ? 'ingredient' : 'ingredients'} tracked</p>
              </div>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Clear all ingredients from your inventory?')) {
                    clearInventory()
                  }
                }}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${isDark ? 'text-red-300 hover:bg-red-900/30' : 'text-red-500 hover:bg-red-50'}`}
              >
                Clear all
              </button>
            )}
            </div>
            
            {items.length === 0 ? (
              <div className={`rounded-2xl border border-dashed p-10 text-center text-sm ${isDark ? 'border-white/15 bg-[#202b24] text-[#9caf9f]' : 'border-slate-200 bg-white text-slate-400'}`}>
                <List size={32} className="mx-auto mb-3 opacity-50" />
                No ingredients yet. Scan your fridge to get started.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {items.map((item) => (
                  <div key={item.id} className={`flex items-center justify-between rounded-xl border p-4 shadow-sm transition-all ${isDark ? 'border-white/10 bg-[#202b24]' : 'border-slate-200 bg-white'}`}>
                    {editingId === item.id ? (
                      <div className="flex w-full flex-col gap-3">
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={`w-full rounded-lg border p-2 text-sm outline-none ${isDark ? 'border-white/20 bg-[#17201b] text-white focus:border-[#a8e8b8]' : 'border-slate-300 bg-slate-50 text-black focus:border-[#318f54]'}`} placeholder="Item Name"/>
                        <div className="flex gap-2">
                          <input type="text" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} className={`flex-1 rounded-lg border p-2 text-sm outline-none ${isDark ? 'border-white/20 bg-[#17201b] text-white focus:border-[#a8e8b8]' : 'border-slate-300 bg-slate-50 text-black focus:border-[#318f54]'}`} placeholder="Quantity"/>
                          <button onClick={() => saveEdit(item.id)} className={`flex items-center justify-center rounded-lg px-4 ${isDark ? 'bg-[#347a4b] text-white' : 'bg-[#318f54] text-white'}`}><Check size={18} /></button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 pr-4">
                          <p className="font-bold text-base">{item.name}</p>
                          <p className={`text-xs mt-0.5 ${isDark ? 'text-[#9caf9f]' : 'text-gray-500'}`}>{item.quantity} {item.brand && `• ${item.brand}`}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => startEditing(item)} className={`p-2 transition-colors rounded-lg ${isDark ? 'text-[#9caf9f] hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-[#318f54]'}`}><Edit2 size={18} /></button>
                          <button onClick={() => removeItem(item.id)} className={`p-2 transition-colors rounded-lg ${isDark ? 'text-[#9caf9f] hover:bg-red-900/40 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-500'}`}><Trash2 size={18} /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CHEF TAB */}
        {activeTab === 'chef' && (
          <div className="h-full overflow-y-auto px-5 pb-4 pt-6">
            <h2 className="mb-2 text-2xl font-bold tracking-tight">Chef Mode</h2>
            <p className={`mb-5 text-sm ${isDark ? 'text-[#9caf9f]' : 'text-slate-500'}`}>Cook with what you have.</p>
            
            <button 
              onClick={handleGenerateRecipe}
              disabled={isGeneratingRecipe || items.length === 0}
              className={`mb-6 flex w-full items-center justify-center gap-2 rounded-xl border py-4 font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 active:scale-[.98] disabled:opacity-50 ${isDark ? 'border-[#347a4b] bg-[#205b35]' : 'border-[#247c46] bg-[#318f54]'}`}
            >
              {isGeneratingRecipe ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
              {isGeneratingRecipe ? 'Ask Sous...' : 'Generate Recipe'}
            </button>

            <div className={`mb-6 rounded-2xl border p-4 ${isDark ? 'border-white/10 bg-[#202b24]' : 'border-slate-200 bg-white'}`}>
              <p className="mb-3 text-sm font-bold">Tell me what you’re in the mood for</p>
              <div className="flex flex-wrap gap-2">
                {recipeOptions.map((option) => {
                  const selected = recipePreferences.includes(option.value)
                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => toggleRecipePreference(option.value)}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${selected
                        ? isDark ? 'border-[#a8e8b8] bg-[#347a4b] text-white' : 'border-[#318f54] bg-[#e4f5e8] text-[#247c46]'
                        : isDark ? 'border-white/15 text-[#9caf9f] hover:bg-white/10' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
              {recipeError && <p className="mt-3 text-sm text-red-500">{recipeError}</p>}
            </div>

            {recipe ? (
              <div className={`overflow-hidden rounded-2xl border shadow-sm ${isDark ? 'border-white/10 bg-[#202b24]' : 'border-slate-200 bg-white'}`}>
                <div className={`p-6 border-b ${isDark ? 'border-white/10 bg-[#1c261f]' : 'border-slate-100 bg-slate-50'}`}>
                  <h3 className="text-xl font-bold leading-tight mb-4">{recipe.title}</h3>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className={`flex items-center gap-1.5 font-medium ${isDark ? 'text-[#a8e8b8]' : 'text-[#318f54]'}`}><Clock size={16}/> {recipe.prepTime}</span>
                    <span className={`flex items-center gap-1.5 font-medium ${isDark ? 'text-[#e8a8a8]' : 'text-orange-600'}`}><Flame size={16}/> {recipe.cookTime}</span>
                    <span className={`flex items-center gap-1.5 font-medium ${isDark ? 'text-[#9caf9f]' : 'text-slate-600'}`}><Users size={16}/> {recipe.servings}</span>
                  </div>
                </div>
                
                <div className="p-6">
                  <h4 className="font-bold mb-3 flex items-center gap-2"><List size={18}/> Ingredients</h4>
                  <ul className="mb-8 space-y-2">
                    {recipe.ingredients.map((ing, i) => (
                      <li key={i} className={`text-sm flex items-start gap-2 ${isDark ? 'text-[#d5e5d7]' : 'text-slate-700'}`}>
                        <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${isDark ? 'bg-[#a8e8b8]' : 'bg-[#318f54]'}`} />
                        {ing}
                      </li>
                    ))}
                  </ul>

                  <h4 className="font-bold mb-3 flex items-center gap-2"><ChefHat size={18}/> Instructions</h4>
                  <div className="space-y-4">
                    {recipe.instructions.map((step, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isDark ? 'bg-white/10 text-[#a8e8b8]' : 'bg-[#e4f5e8] text-[#318f54]'}`}>{i + 1}</span>
                        <p className={`pt-0.5 leading-relaxed ${isDark ? 'text-[#d5e5d7]' : 'text-slate-700'}`}>{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className={`rounded-2xl border p-10 text-center shadow-sm ${isDark ? 'border-white/10 bg-[#202b24]' : 'border-slate-200 bg-white'}`}>
                <ChefHat size={42} className={`mx-auto mb-4 ${isDark ? 'text-[#347a4b]' : 'text-[#b9dfc2]'}`} />
                <p className={`text-sm ${isDark ? 'text-[#9caf9f]' : 'text-slate-500'}`}>
                  {items.length === 0 ? "Scan ingredients first to generate a recipe." : "Tap above to see what Sous can make."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {editingDetectedId && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 px-5">
          <div className={`w-full max-w-sm rounded-2xl p-5 shadow-xl ${isDark ? 'bg-[#202b24] text-white' : 'bg-white text-[#1d2b24]'}`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Edit detected item</h2>
              <button type="button" onClick={() => setEditingDetectedId(null)} aria-label="Close edit dialog" className="rounded-lg p-2 opacity-70 hover:bg-black/5"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-3">
              <label className="text-sm font-semibold">Name
                <input autoFocus type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={`mt-1 w-full rounded-lg border p-3 text-sm outline-none ${isDark ? 'border-white/20 bg-[#17201b] text-white focus:border-[#a8e8b8]' : 'border-slate-300 bg-slate-50 text-black focus:border-[#318f54]'}`} />
              </label>
              <label className="text-sm font-semibold">Quantity
                <input type="text" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} className={`mt-1 w-full rounded-lg border p-3 text-sm outline-none ${isDark ? 'border-white/20 bg-[#17201b] text-white focus:border-[#a8e8b8]' : 'border-slate-300 bg-slate-50 text-black focus:border-[#318f54]'}`} placeholder="e.g. 2 jars" />
              </label>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => { removeItem(editingDetectedId); setDetectedItems((current) => current.filter((item) => item.id !== editingDetectedId)); setEditingDetectedId(null) }} className="flex-1 rounded-lg border border-red-200 py-3 font-semibold text-red-500 hover:bg-red-50">Remove</button>
                <button type="button" onClick={() => saveDetectedEdit(editingDetectedId)} className={`flex-1 rounded-lg py-3 font-semibold text-white ${isDark ? 'bg-[#347a4b]' : 'bg-[#318f54]'}`}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCameraOpen && (
        <div className="absolute inset-0 z-30 flex flex-col bg-black">
          <div className="flex items-center justify-between px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
            <button type="button" onClick={stopCamera} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"><X size={20} /></button>
            <button type="button" onClick={takePhoto} disabled={!!cameraError} className="rounded-full bg-white p-2 text-black disabled:opacity-40 hover:scale-105 transition-transform"><Circle size={34} fill="currentColor" strokeWidth={1.5} /></button>
          </div>
          {cameraError ? <p className="m-auto px-8 text-center text-sm text-zinc-300">{cameraError}</p> : <video ref={videoRef} autoPlay playsInline muted className="min-h-0 flex-1 object-cover" />}
        </div>
      )}

      {!isCameraOpen && <div ref={sidekickConstraintsRef} className="pointer-events-none absolute inset-0 z-30">
        <motion.div
          drag
          dragConstraints={sidekickConstraintsRef}
          dragMomentum={false}
          dragElastic={0.08}
          className="pointer-events-auto absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom))] h-24 w-20"
          style={{ left: 'calc(50% - 40px)' }}
        >
          {isSidekickOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={`absolute bottom-[calc(100%+0.5rem)] right-0 w-64 origin-bottom-right rounded-2xl border p-4 shadow-xl ${isDark ? 'border-[#347a4b]/60 bg-[#202b24]' : 'border-[#b9dfc2] bg-white'}`}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <p className={`mb-3 text-sm leading-relaxed ${isDark ? 'text-[#d5e5d7]' : 'text-slate-600'}`}>{sidekickTip}</p>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('chef')
                    setIsSidekickOpen(false)
                    if (!recipe && !isGeneratingRecipe) handleGenerateRecipe()
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-bold text-white ${isDark ? 'bg-[#347a4b]' : 'bg-[#318f54]'}`}
                >
                  {recipe ? 'Open recipe' : 'Make a recipe'}
                </button>
              )}
            </motion.div>
          )}
          {!isSidekickOpen && (
            <span className={`absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold shadow-sm ${isDark ? 'border-white/10 bg-[#202b24] text-[#a8e8b8]' : 'border-[#b9dfc2] bg-white text-[#318f54]'}`}>
              Drag me • tap to chat
            </span>
          )}
          <motion.button
            type="button"
            onClick={toggleSidekick}
            aria-label="Talk to Sous"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{ rotate: [-2, 2, -2] }}
            transition={{ rotate: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' } }}
            className="h-24 w-20 cursor-grab touch-none active:cursor-grabbing"
          >
            <img src="/chef.png" alt="Sous the digital chef" className="h-full w-full object-contain drop-shadow-lg" />
          </motion.button>
        </motion.div>
      </div>}

      <nav className={`z-20 flex w-full shrink-0 items-center justify-around border-t px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 transition-colors duration-300 ${isDark ? 'border-white/10 bg-[#202b24]' : 'border-[#dfe6dc] bg-white'}`}>
        <button onClick={() => setActiveTab('scanner')} className={`flex flex-col items-center gap-1 p-2 transition-all duration-200 hover:-translate-y-0.5 active:scale-90 ${activeTab === 'scanner' ? (isDark ? 'text-[#a8e8b8]' : 'text-[#318f54]') : isDark ? 'text-[#809388]' : 'text-[#9aa69c]'}`}><Camera size={22} /></button>
        <button onClick={() => setActiveTab('inventory')} className={`flex flex-col items-center gap-1 p-2 transition-all duration-200 hover:-translate-y-0.5 active:scale-90 ${activeTab === 'inventory' ? (isDark ? 'text-[#a8e8b8]' : 'text-[#318f54]') : isDark ? 'text-[#809388]' : 'text-[#9aa69c]'}`}><List size={22} /></button>
        <button onClick={() => setActiveTab('chef')} className={`flex flex-col items-center gap-1 p-2 transition-all duration-200 hover:-translate-y-0.5 active:scale-90 ${activeTab === 'chef' ? (isDark ? 'text-[#a8e8b8]' : 'text-[#318f54]') : isDark ? 'text-[#809388]' : 'text-[#9aa69c]'}`}><ChefHat size={22} /></button>
      </nav>
    </main>
  )
}