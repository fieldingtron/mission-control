-- Function to sync sequences for all tables
CREATE OR REPLACE FUNCTION sync_sequences()
RETURNS void AS $$
DECLARE
    max_panel_id INTEGER;
    max_cat_id INTEGER;
    max_link_id INTEGER;
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_panel_id FROM panels;
    SELECT COALESCE(MAX(id), 0) INTO max_cat_id FROM categories;
    SELECT COALESCE(MAX(id), 0) INTO max_link_id FROM links;

    IF max_panel_id > 0 THEN
        PERFORM setval('panels_id_seq', max_panel_id);
    END IF;

    IF max_cat_id > 0 THEN
        PERFORM setval('categories_id_seq', max_cat_id);
    END IF;

    IF max_link_id > 0 THEN
        PERFORM setval('links_id_seq', max_link_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
