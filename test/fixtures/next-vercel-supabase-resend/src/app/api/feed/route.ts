import { supabase } from '../../../lib/supabase';

export async function GET() {
	const { data } = await supabase.from('events').select('*').limit(50);
	return Response.json(data);
}
