import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export async function POST(req: NextRequest) {
  try {
    const { inventory, filters } = await req.json()

    if (!inventory || inventory.length === 0) {
      return NextResponse.json({ error: 'Inventory is empty' }, { status: 400 })
    }

    const ai = new GoogleGenAI({
      project: process.env.GOOGLE_CLOUD_PROJECT as string,
      location: 'global',
      vertexai: true
    })

    const ingredientsList = inventory.map((i: any) => `${i.name} (${i.quantity || 'unknown quantity'})`).join(', ')

    const prompt = `
      I have the following ingredients in my kitchen: ${ingredientsList}.
      My preferences/filters are: ${filters.join(', ')}.
      
      Generate a realistic, high-quality recipe using primarily these ingredients. 
      You MUST respond with a valid JSON object matching this exact structure:
      {
        "title": "Recipe Name",
        "prepTime": "XX mins",
        "cookTime": "XX mins",
        "servings": "X servings",
        "ingredients": ["1 cup ingredient", "2 tbsp ingredient"],
        "instructions": ["Step 1 description", "Step 2 description"]
      }
      
      Respond ONLY with the raw JSON object. Do not include markdown formatting like \`\`\`json.
    `

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt
    })

    const responseText = response.text || "{}"
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim()
    const recipeData = JSON.parse(cleanJson)

    return NextResponse.json({ recipe: recipeData })

  } catch (error) {
    console.error('Recipe API Error:', error)
    return NextResponse.json({ error: 'Failed to generate recipe' }, { status: 500 })
  }
}