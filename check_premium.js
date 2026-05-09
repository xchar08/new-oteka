const { createClient } = require('@supabase/supabase-js');
const url = 'https://wnfnyhmqfxtkwsnjdlsv.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduZm55aG1xZnh0a3dzbmpkbHN2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTI3NTM1MiwiZXhwIjoyMDg0ODUxMzUyfQ.fO_hKdrh3oL1mSh9ZEZOwPWZ0tLglIqxNbgFV66nbw0';
const supabase = createClient(url, key);

async function run() {
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('List error:', listError);
    return;
  }
  const user = users.users.find(u => u.email === 'jeremiahnpitts@gmail.com');
  if (!user) {
    console.log('User jeremiahnpitts@gmail.com not found');
    return;
  }
  console.log('User ID:', user.id);
  
  const { data: profile, error: profileError } = await supabase.from('users').select('plan').eq('id', user.id).single();
  if (profileError) {
    console.error('Profile error:', profileError);
  } else {
    console.log('Current plan:', profile.plan);
    if (profile.plan !== 'pro') {
      const { error: updateError } = await supabase.from('users').update({ plan: 'pro' }).eq('id', user.id);
      if (updateError) {
        console.error('Update error:', updateError);
      } else {
        console.log('Successfully updated jeremiahnpitts@gmail.com to premium (pro) plan');
      }
    } else {
      console.log('jeremiahnpitts@gmail.com is already premium (pro)');
    }
  }
}
run();
