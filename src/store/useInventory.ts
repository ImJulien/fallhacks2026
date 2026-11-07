import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type InventoryItem = {
  id: string
  name: string
  brand?: string
  quantity?: string
  box_2d?: [number, number, number, number] // [ymin, xmin, ymax, xmax]
}

interface InventoryState {
  items: InventoryItem[]
  addItem: (item: InventoryItem) => void
  removeItem: (id: string) => void
  updateItem: (id: string, updatedItem: Partial<InventoryItem>) => void
  clearInventory: () => void
}

export const useInventory = create<InventoryState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) => set((state) => ({ items: [...state.items, item] })),
      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      updateItem: (id, updatedItem) =>
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, ...updatedItem } : i)),
        })),
      clearInventory: () => set({ items: [] }),
    }),
    {
      name: 'pantry-vision-storage', 
    }
  )
)