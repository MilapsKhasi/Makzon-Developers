
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://siwceltyyhswddnlaibc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpd2NlbHR5eWhzd2RkbmxhaWJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMTA2OTAsImV4cCI6MjA4MTg4NjY5MH0.uRhNoXhxjHAp7C9oZZrW0o4ZhzNxRiISvNeIj5WX1RE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
