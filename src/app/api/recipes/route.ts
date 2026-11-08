import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

interface RecipeInventoryItem {
  name: string
  quantity?: string
}

interface SavedRecipeSummary {
  title: string
  ingredients: string[]
}

export async function POST(req: NextRequest) {
  try {
    const { inventory, filters, savedRecipes } = await req.json() as {
      inventory: RecipeInventoryItem[]
      filters: string[]
      savedRecipes?: SavedRecipeSummary[]
    }

    if (!inventory || inventory.length === 0) {
      return NextResponse.json({ error: 'Inventory is empty' }, { status: 400 })
    }

    const ai = new GoogleGenAI({
      project: process.env.GOOGLE_CLOUD_PROJECT as string,
      location: 'global',
      vertexai: true
    })

    const ingredientsList = inventory.map((i: RecipeInventoryItem) => `${i.name} (${i.quantity || 'unknown quantity'})`).join(', ')
    const savedRecipesList = (savedRecipes || []).map((saved) =>
      `- ${saved.title}: ${saved.ingredients.join(', ')}`
    ).join('\n')

    const prompt = `
      I have the following ingredients in my kitchen: ${ingredientsList}.
      My preferences/filters are: ${filters.join(', ')}.
      ${savedRecipesList
        ? `The user has already saved these recipes:
${savedRecipesList}

Do not repeat or closely imitate any saved recipe. Choose a meaningfully different cooking method, flavor profile, and dish format when possible.`
        : 'There are no saved recipes to avoid yet.'}
      
      Generate a realistic, high-quality recipe using primarily these ingredients. 
      Estimate the grocery cost of the ingredients used and format it as a US dollar range or amount.
      You MUST respond with a valid JSON object matching this exact structure:
      {
        "title": "Recipe Name",
        "prepTime": "XX mins",
        "cookTime": "XX mins",
        "servings": "X servings",
        "priceEstimate": "$X.XX",
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