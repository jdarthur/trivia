import {createApi, fetchBaseQuery, retry} from '@reduxjs/toolkit/query/react';
import type {Category, Collection, Question, Round, ScoringNote} from '../types/models';
import type {ListMeta} from './listParams';

export const baseQuery = retry(fetchBaseQuery({
    baseUrl: '/',
    prepareHeaders: (headers, {getState}) => {
        // fetchBaseQuery types getState as `unknown`; narrow to the auth slice
        // we actually read. Kept inline to avoid a type-only import cycle with
        // store.ts (which imports main.ts at runtime).
        const userToken = (getState() as { auth: { token: string | null } }).auth.token;

        if (userToken) {
            headers.set('borttrivia-token', userToken);
        }

        return headers;
    },
    fetchFn: (input) => {
        // Don't bother sending editor requests we know will be rejected. Return
        // a real 401 Response rather than undefined, so the caller always has
        // something it can await and read a status off of.
        // RTK types `input` as RequestInfo (Request | string); we always receive
        // a Request here, so narrow it to read the header.
        if (!(input as Request).headers.get('borttrivia-token')) {
            return Promise.resolve(new Response(JSON.stringify({error: 'no auth token'}), {
                status: 401,
                headers: {'Content-Type': 'application/json'},
            }))
        }
        return fetch(input)
    }

}), {
    // Note: retryCondition replaces maxRetries, so the attempt cap lives here.
    // Retrying an auth failure just burns five round-trips, since the token
    // can't change in the middle of a retry loop.
    retryCondition: (error, args, {attempt}) => {
        // RTK types `error` as unknown; we only care about the HTTP status.
        const status = (error as { status?: number }).status;
        if (status === 401 || status === 403) {
            return false
        }
        return attempt <= 5
    },
})

/**
 * The envelope an editor list endpoint returns (ticket #195): the records under
 * the endpoint's domain key, plus the pagination metadata. K names that key, so
 * one type covers questions / rounds / categories / collections.
 */
export type ListResponse<T, K extends string> = ListMeta & Record<K, T[]>

export const mainApi = createApi({
    reducerPath: 'mainApi',
    baseQuery: baseQuery,
    tagTypes: ['collections', 'questions', 'scoring_notes', 'categories', 'rounds'],
    endpoints: (builder) => ({
        getCollections: builder.query<ListResponse<Collection, "collections">, string>({
            query: (queryParams) => ({url: `editor/collections${queryParams ? queryParams : ""}`}),
            providesTags: ['collections']
        }),
        getCollection: builder.query<Collection, string>({
            query: (id) => ({url: `editor/collections/${id}`}),
        }),
        createCollection: builder.mutation<Collection, Partial<Collection>>({
            query: (body) => ({
                url: `editor/collections`,
                method: "POST",
                body: body
            }),
            invalidatesTags: ['collections']
        }),
        deleteCollection: builder.mutation<Collection, string>({
            query: (id) => ({
                url: `editor/collections/${id}`,
                method: "DELETE"
            }),
            invalidatesTags: ['collections']
        }),
        importCollection: builder.mutation<{questions: Question[]}, string>({
            query: (id) => ({
                url: `editor/collections/${id}/import`,
                method: "POST"
            }),
        }),
        // List endpoints take the shared filter/pagination params (ticket #195)
        // and return the records plus pagination metadata. The query arg is the
        // serialized query string — see buildListQuery — because RTK keys its
        // cache off that arg, so building it in the caller keeps one entry per
        // distinct filter/page combination.
        getQuestions: builder.query<ListResponse<Question, "questions">, string>({
            query: (queryParams) => ({
                url: `editor/questions${queryParams ? queryParams : ""}`,
            }),
            providesTags: ["questions"]
        }),
        createQuestion: builder.mutation<Question, Partial<Question>>({
            query: (body) => ({
                url: `editor/question`,
                method: "POST",
                body: body
            }),
            invalidatesTags: ["questions"]
        }),
        updateQuestion: builder.mutation<Question, {id: string; body: Partial<Question>}>({
            query: (args) => ({
                url: `editor/question/${args.id}`,
                method: "PUT",
                body: args.body
            }),
            invalidatesTags: ["questions"]
        }),
        deleteQuestion: builder.mutation<Question, string>({
            query: (id) => ({
                url: `editor/question/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["questions"]
        }),
        getRounds: builder.query<ListResponse<Round, "rounds">, string>({
            query: (queryParams) => ({
                url: `editor/rounds${queryParams ? queryParams : ""}`,
            }),
            providesTags: ["rounds"]
        }),
        createRound: builder.mutation<Round, Partial<Round>>({
            query: (body) => ({
                url: `editor/round`,
                method: "POST",
                body: body
            }),
            invalidatesTags: ["rounds", "questions"]
        }),
        updateRound: builder.mutation<Round, {id: string; body: Partial<Round>}>({
            query: (args) => ({
                url: `editor/round/${args.id}`,
                method: "PUT",
                body: args.body
            }),
            // Adding/removing questions changes their rounds_used membership,
            // so the questions list (and its unused-only filter) must refetch.
            invalidatesTags: ["rounds", "questions"]
        }),
        deleteRound: builder.mutation<Round, string>({
            query: (id) => ({
                url: `editor/round/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["rounds", "questions"]
        }),
        getScoringNotes: builder.query<ScoringNote[], void>({
            query: () => ({
                url: `editor/scoring_notes`,
            }),
            providesTags: ["scoring_notes"]
        }),
        getOneScoringNote: builder.query<ScoringNote, string>({
            query: (id) => ({
                url: `editor/scoring_notes/${id}`,
            }),
        }),
        createScoringNote: builder.mutation<ScoringNote, Partial<ScoringNote>>({
            query: (body) => ({
                url: `editor/scoring_notes`,
                method: "POST",
                body: body
            }),
            invalidatesTags: ["scoring_notes"]
        }),
        deleteScoringNote: builder.mutation<ScoringNote, string>({
            query: (id) => ({
                url: `editor/scoring_notes/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["scoring_notes", "questions"]
        }),
        getCategories: builder.query<ListResponse<Category, "categories">, string>({
            query: (queryParams) => ({
                url: `editor/categories${queryParams ? queryParams : ""}`,
            }),
            providesTags: ["categories"]
        }),
        getOneCategory: builder.query<Category, string>({
            query: (id) => ({
                url: `editor/category/${id}`,
            }),
        }),
        createCategory: builder.mutation<Category, Partial<Category>>({
            query: (body) => ({
                url: `editor/category`,
                method: "POST",
                body: body
            }),
            invalidatesTags: ["categories"]
        }),
        updateCategory: builder.mutation<Category, {id: string; body: Partial<Category>}>({
            query: (args) => ({
                url: `editor/category/${args.id}`,
                method: "PUT",
                body: args.body
            }),
            // A renamed category (or a changed note) shows up in every place
            // questions are listed, so refresh questions too.
            invalidatesTags: ["categories", "questions"]
        }),
        deleteCategory: builder.mutation<Category, string>({
            query: (id) => ({
                url: `editor/category/${id}`,
                method: "DELETE",
            }),
            // Deleting a category nulls referencing questions' category_id
            // server-side, so the question list must refetch.
            invalidatesTags: ["categories", "questions"]
        }),
    })
})

export const {
    useGetCollectionsQuery,
    useGetCollectionQuery,
    useCreateCollectionMutation,
    useDeleteCollectionMutation,
    useImportCollectionMutation,
    useGetQuestionsQuery,
    useCreateQuestionMutation,
    useUpdateQuestionMutation,
    useDeleteQuestionMutation,
    useGetRoundsQuery,
    useCreateRoundMutation,
    useUpdateRoundMutation,
    useDeleteRoundMutation,
    useGetScoringNotesQuery,
    useGetOneScoringNoteQuery,
    useCreateScoringNoteMutation,
    useDeleteScoringNoteMutation,
    useGetCategoriesQuery,
    useGetOneCategoryQuery,
    useCreateCategoryMutation,
    useUpdateCategoryMutation,
    useDeleteCategoryMutation,
} = mainApi

/**
 * Convenience wrappers for the consumers that want a whole list rather than a
 * page — category selectors, category-name resolution, the collection editor's
 * question picker. They hit the list endpoint with no filters (so the server
 * returns everything, unpaginated) and unwrap the list envelope, letting these
 * callers keep reading a plain array. The query arg is the same "" literal in
 * each place, so every one of them shares a single cache entry.
 */
export function useAllCategories() {
    const result = useGetCategoriesQuery("")
    return {...result, data: result.data?.categories}
}

export function useAllQuestions() {
    const result = useGetQuestionsQuery("")
    return {...result, data: result.data?.questions}
}
