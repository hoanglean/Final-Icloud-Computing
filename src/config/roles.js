const roleHome = role => role === 'admin' ? '/admin' : '/staff';

module.exports = { roleHome };
