UPDATE flows
SET miniapp_enabled = true,
    miniapp = jsonb_build_object(
      'title', 'Барбершоп',
      'subtitle', 'Стрижки и уход',
      'accent', 'orange',
      'itemsLabel', 'Услуги',
      'hero', jsonb_build_object(
        'title', 'Запишись онлайн',
        'subtitle', 'Лучшие мастера города',
        'cta', 'Записаться',
        'icon', 'sparkles'
      ),
      'stats', jsonb_build_array(
        jsonb_build_object('label','Мастеров','value','6'),
        jsonb_build_object('label','Услуг','value','12'),
        jsonb_build_object('label','Рейтинг','value','4.9','unit','/5')
      ),
      'items', jsonb_build_array(
        jsonb_build_object('title','Мужская стрижка','subtitle','45 мин','meta','1500 ₽','emoji','💈'),
        jsonb_build_object('title','Стрижка бороды','subtitle','30 мин','meta','900 ₽','emoji','🧔'),
        jsonb_build_object('title','Бритьё опасной бритвой','subtitle','40 мин','meta','1200 ₽','emoji','🪒'),
        jsonb_build_object('title','Камуфляж седины','subtitle','25 мин','meta','800 ₽','emoji','🎨'),
        jsonb_build_object('title','Детская стрижка','subtitle','30 мин','meta','1000 ₽','emoji','🧒'),
        jsonb_build_object('title','Комплекс «Стрижка + борода»','subtitle','75 мин','meta','2200 ₽','emoji','✨','badge','Хит')
      ),
      'plans', jsonb_build_array(
        jsonb_build_object('id','single','name','Разовый визит','price','от 900','unit','₽','description','Любая услуга по прайсу'),
        jsonb_build_object('id','club','name','Клубная карта','price','9900','unit','₽/мес','description','Безлимит стрижек, скидка 20% на уход','highlight',true,'features',jsonb_build_array('Безлимит стрижек','Скидка 20%','Приоритетная запись'))
      ),
      'tabs', jsonb_build_array(
        jsonb_build_object('id','home','label','Главная','icon','home'),
        jsonb_build_object('id','items','label','Услуги','icon','list'),
        jsonb_build_object('id','plans','label','Цены','icon','plans'),
        jsonb_build_object('id','profile','label','Профиль','icon','profile')
      )
    )
WHERE slug = 'flow-34b84919';