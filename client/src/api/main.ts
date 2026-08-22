import {createApi, fetchBaseQuery, retry} from '@reduxjs/toolkit/query/react';
import type {Collection, Question, ScoringNote} from '../types/models';

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

export const mainApi = createApi({
    reducerPath: 'mainApi',
    baseQuery: baseQuery,
    tagTypes: ['collections', 'questions', 'scoring_notes'],
    endpoints: (builder) => ({
        getCollections: builder.query<{collections: Collection[]}, void>({
            query: () => ({url: `editor/collections`}),
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
        getQuestions: builder.query<{questions: Question[]}, string>({
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
    useGetScoringNotesQuery,
    useGetOneScoringNoteQuery,
    useCreateScoringNoteMutation,
    useDeleteScoringNoteMutation,
} = mainApi
