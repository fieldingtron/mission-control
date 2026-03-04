import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

export const panels = sqliteTable('panels', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
});

export const categories = sqliteTable('categories', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    panel_id: integer('panel_id').references(() => panels.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
});

export const links = sqliteTable('links', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    category_id: integer('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    url: text('url').notNull(),
    position: integer('position').notNull().default(0),
    description: text('description'),
});

export const backups = sqliteTable('backups', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
    label: text('label'),
    data: text('data').notNull(),
});

// Relations
export const panelsRelations = relations(panels, ({ many }) => ({
    categories: many(categories),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
    panel: one(panels, {
        fields: [categories.panel_id],
        references: [panels.id],
    }),
    links: many(links),
}));

export const linksRelations = relations(links, ({ one }) => ({
    category: one(categories, {
        fields: [links.category_id],
        references: [categories.id],
    }),
}));
