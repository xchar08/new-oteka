-- Manual update for Jeremiah
UPDATE users SET plan = 'pro' WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'jeremiahnpitts@gmail.com'
);
