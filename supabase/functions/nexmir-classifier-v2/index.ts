import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}
// Use the same subject names as the web importer and student view.
import '../_shared/taxonomy.js'
const subjects: string[] = (globalThis as any).RemnoteTaxonomy.subjects
const pendingFilter = 'specialty.is.null,specialty.eq."",specialty.eq."Sin clasificar",specialty.eq.Desagrupadas'
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: cors })
const secret = (legacy: string, modern: string) => {
  const direct = Deno.env.get(legacy)
  if (direct) return direct
  try {
    const configured = JSON.parse(Deno.env.get(modern) || '{}').default
    return typeof configured === 'string' ? configured : configured?.key || ''
  } catch { return '' }
}
const outputText = (result: any) => {
  if (typeof result?.output_text === 'string') return result.output_text
  for (const part of result?.output || []) for (const content of part?.content || [])
    if (content?.type === 'output_text' && content.text) return content.text
  return ''
}
const valueText = (row: any, kind: 'content'|'question') => kind === 'content'
  ? `${row.payload?.front||''}\n${row.payload?.back||''}\n${row.payload?.text||''}\n${(row.payload?.context||[]).join(' › ')}\n${row.source_path||''}`
  : `${row.stem||''}\n${(row.options||[]).join('\n')}\n${row.explanation||''}`

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', {headers:cors})
  try {
    if (request.method !== 'POST') return json({error:'Solo POST'},405)
    const url = Deno.env.get('SUPABASE_URL') || ''
    const publishable = secret('SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEYS')
    const service = secret('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEYS')
    const apiKey = Deno.env.get('OPENAI_API_KEY') || ''
    const model = Deno.env.get('OPENAI_CLASSIFIER_MODEL') || 'gpt-4.1-mini'
    const bearer = request.headers.get('Authorization') || ''
    if (!url || !publishable) return json({error:'Faltan variables automáticas de Supabase.'},500)
    if (!bearer.startsWith('Bearer ')) return json({error:'Inicia sesión como administrador.'},401)
    const userClient = createClient(url,publishable,{global:{headers:{Authorization:bearer}}})
    const {data:{user},error:authError} = await userClient.auth.getUser(bearer.slice(7))
    if (authError || !user) return json({error:'Sesión caducada. Vuelve a entrar.'},401)
    const {data:profile,error:roleError} = await userClient.from('profiles').select('role').eq('id',user.id).single()
    if (roleError || !['admin','moderator'].includes(profile?.role)) return json({error:'Solo el personal autorizado puede clasificar.'},403)
    const body = await request.json().catch(()=>({}))
    if (body.action === 'health') return json({ready:!!apiKey&&!!service,model,reason:!apiKey?'Falta OPENAI_API_KEY en Edge Function Secrets.':!service?'Falta la clave secreta de Supabase en el entorno de la función.':null,version:'5.0.12'})
    if (!apiKey) return json({error:'Falta OPENAI_API_KEY en Edge Function Secrets.'},503)
    if (!service) return json({error:'Falta la clave secreta de Supabase en el entorno de la función.'},503)
    if (body.action === 'test') {
      const probe = await fetch('https://api.openai.com/v1/responses',{
        method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
        body:JSON.stringify({model,input:'Devuelve únicamente la palabra Cardiología.'}),
      })
      if (!probe.ok) {
        const detail = await probe.json().catch(()=>({}))
        throw new Error(`OpenAI ${probe.status}: ${String(detail?.error?.message||'Comprueba la clave API y el modelo.').slice(0,200)}`)
      }
      const answer=outputText(await probe.json()).trim()
      if (!/cardiolog/i.test(answer)) throw new Error('La API respondió, pero no se obtuvo la respuesta de prueba esperada.')
      return json({ready:true,model,version:'5.0.12',modified:0})
    }

    const admin = createClient(url,service)
    const limit = Math.max(1,Math.min(40,Number(body.limit)||20))
    const [{data:content,error:ce},{data:questions,error:qe}] = await Promise.all([
      admin.from('content_items').select('id,specialty,topic,subtopic,section,payload,source_path').eq('status','published').or(pendingFilter).limit(limit),
      admin.from('questions').select('id,specialty,topic,subtopic,stem,options,explanation').eq('status','published').or(pendingFilter).limit(limit),
    ])
    if (ce || qe) throw ce || qe
    const pending = [...(content||[]).map(x=>({id:x.id,kind:'content' as const,row:x,text:valueText(x,'content')})),
      ...(questions||[]).map(x=>({id:x.id,kind:'question' as const,row:x,text:valueText(x,'question')}))].slice(0,limit)
    let updated = 0
    for (let start=0;start<pending.length;start+=10) {
      const batch = pending.slice(start,start+10)
      const prompt = `Clasifica estas tarjetas para el MIR. Devuelve SOLO un array JSON de objetos {id,kind,specialty,topic,subtopic,confidence}. Asignaturas permitidas: ${subjects.join(' | ')}. Usa confidence entre 0 y 1; si no sabes con certeza >=0.70, usa Desagrupadas. No inventes detalles médicos.\n\n`+
        batch.map(x=>`ID=${x.id} KIND=${x.kind}\n${x.text.slice(0,1800)}`).join('\n---\n')
      const response = await fetch('https://api.openai.com/v1/responses',{
        method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
        body:JSON.stringify({model,input:prompt}),
      })
      if (!response.ok) {
        const detail = await response.json().catch(()=>({}))
        throw new Error(`OpenAI ${response.status}: ${String(detail?.error?.message||'No se pudo obtener la clasificación.').slice(0,200)}`)
      }
      const raw = outputText(await response.json()).trim().replace(/^```(?:json)?\s*/i,'').replace(/```$/,'').trim()
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) throw new Error('La IA no devolvió una lista de clasificaciones.')
      for (const result of parsed) {
        const target = batch.find(x=>x.id===result?.id&&x.kind===result?.kind)
        if (!target || Number(result.confidence)<0.70 || !subjects.includes(result.specialty)) continue
        const specialty = result.specialty,topic = String(result.topic||'General').slice(0,180)
        const subtopic = result.subtopic?String(result.subtopic).slice(0,180):null
        const patch:any = {specialty,topic,subtopic,updated_at:new Date().toISOString()}
        if (target.kind === 'content') patch.payload={...target.row.payload,specialty,topic,subtopic,section:target.row.section||null,classification_origin:'ai'}
        const table = target.kind==='content'?'content_items':'questions'
        const {data,error} = await admin.from(table).update(patch).eq('id',target.id).or(pendingFilter).select('id')
        if (error) throw error
        updated += data?.length||0
      }
    }
    const [{count:a,error:ae},{count:b,error:be}] = await Promise.all([
      admin.from('content_items').select('id',{count:'exact',head:true}).eq('status','published').or(pendingFilter),
      admin.from('questions').select('id',{count:'exact',head:true}).eq('status','published').or(pendingFilter),
    ])
    if (ae || be) throw ae || be
    return json({updated,processed:pending.length,remaining:(a||0)+(b||0),version:'5.0.12'})
  } catch (e) {
    return json({error:String((e as Error)?.message||e).slice(0,350)},500)
  }
})
