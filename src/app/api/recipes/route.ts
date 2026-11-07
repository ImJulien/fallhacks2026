import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const keys = process.env.GEMINI_API_KEYS?.split(',') || []

export async function POST(req: NextRequest) {
  try {
    const randomKey = keys[Math.floor(Math.random() * keys.length)]
    const genAI = new GoogleGenerativeAI(randomKey)

    const { inventory, filters } = await req.json()

    if (!inventory || inventory.length === 0) {
      return NextResponse.json({ error: 'Inventory is empty' }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const ingredientsList = inventory.map((i: any) => `${i.name} (${i.quantity || 'unknown quantity'})`).join(', ')

    const prompt = `
      I have the following ingredients in my kitchen: ${ingredientsList}.
      My preferences/filters are: ${filters.join(', ')}.
      
      Generate a realistic recipe using primarily these ingredients. 
      Format the response cleanly with a Title, Prep Time, Ingredients list, and numbered Instructions.
      Do not use markdown code blocks, just plain text with standard markdown formatting (like **bold** for titles).
    `

    const result = await model.generateContent(prompt)
    const recipe = result.response.text()

    return NextResponse.json({ recipe })

  } catch (error) {
    console.error('Recipe API Error:', error)
    return NextResponse.json({ error: 'Failed to generate recipe' }, { status: 500 })
  }
}