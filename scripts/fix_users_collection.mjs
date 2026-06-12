import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';
const PB_ADMIN_EMAIL = 'admin@int.com';
const PB_ADMIN_PASSWORD = '123456789admin';

async function main() {
  console.log('🚀 Connecting to PocketBase to fix users collection API rules...');
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  console.log('✅ PocketBase superuser authenticated successfully!');

  try {
    const usersCollection = await pb.collections.getOne('users');
    console.log('📋 Current users collection rules:', {
      listRule: usersCollection.listRule,
      viewRule: usersCollection.viewRule,
    });

    // Update rules to allow public reading of basic profiles (names/avatars/usernames)
    await pb.collections.update('users', {
      listRule: '', // Empty string means anyone (public) can read/list profiles
      viewRule: '', // Empty string means anyone can view individual profiles
    });

    console.log('🎉 SUCCESS: Users collection API rules updated to public! Anyone can now see usernames/avatars.');
  } catch (error) {
    console.error('❌ Failed to update users collection:', error.message);
  }
}

main();
