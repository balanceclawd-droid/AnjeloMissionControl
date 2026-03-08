import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sljflqdkkkolawjoijjr.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsamZscWRra2tvbGF3am9pampyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5Nzc5ODcsImV4cCI6MjA4ODU1Mzk4N30.BGGKS3kkZwFq7TOq0Z_FsSS3oP1jOKFKmjhfGpUXz_U'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
