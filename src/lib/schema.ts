import { pgTable, serial, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const panels = pgTable('panels', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
});

export const categories = pgTable('categories', {
    id: serial('id').primaryKey(),
    panel_id: integer('panel_id').references(() => panels.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
});

export const links = pgTable('links', {
    id: serial('id').primaryKey(),
    category_id: integer('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    url: text('url').notNull(),
    position: integer('position').notNull().default(0),
    description: text('description'),
});

export const backups = pgTable('backups', {
    id: serial('id').primaryKey(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
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
