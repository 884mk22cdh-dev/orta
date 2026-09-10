/** Виджет ORTA: следующая пара на экране блокировки и главном экране */
module.exports = {
  type: 'widget',
  name: 'ORTAWidget',
  icon: '../../assets/icon.png',
  entitlements: {
    'com.apple.security.application-groups': ['group.kz.orta.app'],
  },
};
