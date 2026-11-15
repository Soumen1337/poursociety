-- PourSociety image repairs and duplicate cleanup — 16 November 2026.

delete from public.products
where id in ('moet-imperial','sula-dindori','jacobs-creek-chard');

update public.products
set image_url='https://bevmo.com/cdn/shop/files/57f58993-4b15-4c44-bdcd-2878e8801ff8-padded.png?v=1765396868',
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'photo_source_url','https://bevmo.com/cdn/shop/files/57f58993-4b15-4c44-bdcd-2878e8801ff8-padded.png?v=1765396868',
      'photo_source_status','selected_from_product_listing_2026-11-16'
    ),
    updated_at=now()
where id='moet-chandon-brut';

update public.products
set image_url='https://liquorgenie.in/wp-content/uploads/2020/07/sq_701433455.jpg',
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'photo_source_url','https://liquorgenie.in/wp-content/uploads/2020/07/sq_701433455.jpg',
      'photo_source_status','selected_from_product_listing_2026-11-16'
    ),
    updated_at=now()
where id='sula-dindori-shiraz';

update public.products
set image_url='https://storage.googleapis.com/images-lnb-prd-8936dd0.lnb.prd.v8.commerce.mi9cloud.com/product-images/zoom/00080432340073.png',
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'photo_source_url','https://storage.googleapis.com/images-lnb-prd-8936dd0.lnb.prd.v8.commerce.mi9cloud.com/product-images/zoom/00080432340073.png',
      'photo_source_status','selected_from_product_listing_2026-11-16'
    ),
    updated_at=now()
where id='jacobs-creek-chardonnay';

update public.products
set image_url='https://www.whiskyshop.com/media/catalog/product/m/a/macallan_12yo_doublecask_ss.jpg?image-type=image&store=whiskyshop&width=2500',
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'photo_source_url','https://www.whiskyshop.com/media/catalog/product/m/a/macallan_12yo_doublecask_ss.jpg?image-type=image&store=whiskyshop&width=2500',
      'photo_source_status','selected_from_product_listing_2026-11-16'
    ),
    updated_at=now()
where id='macallan-12';
