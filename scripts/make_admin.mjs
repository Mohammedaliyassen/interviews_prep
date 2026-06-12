import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';
const PB_ADMIN_EMAIL = 'admin@int.com';
const PB_ADMIN_PASSWORD = '123456789admin';

const ADMIN_EMAILS = [
  'mido200117@gmail.com',
  'waves.devtech@gmail.com',
  'mohammedyassen200117@gmail.com'
];

async function main() {
  console.log('🚀 Connecting to PocketBase to elevate users to admin...');
  const pb = new PocketBase(PB_URL);
  
  try {
    await pb.admins.authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
    console.log('✅ PocketBase superuser authenticated successfully!');
  } catch (error) {
    console.error('❌ Superuser authentication failed:', error.message);
    process.exit(1);
  }

  for (const email of ADMIN_EMAILS) {
    try {
      const users = await pb.collection('users').getList(1, 10, {
        filter: `email = "${email}"`
      });

      if (users.items.length === 0) {
        console.log(`⚠️ User with email "${email}" not found.`);
        continue;
      }

      const targetUser = users.items[0];
      console.log(`📋 Found user: ${targetUser.email} (id: ${targetUser.id}, current role: ${targetUser.role || 'none'})`);

      const updated = await pb.collection('users').update(targetUser.id, {
        role: 'admin'
      });

      console.log(`🎉 SUCCESS: Elevated user ${updated.email} to role '${updated.role}'!`);
    } catch (error) {
      console.error(`❌ Failed to update user ${email}:`, error.message);
    }
  }
}

main();
