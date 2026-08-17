import {createApi, fetchBaseQuery, retry} from '@reduxjs/toolkit/query/react';


export const baseQuery = retry(fetchBaseQuery({
    baseUrl: '/',
    prepareHeaders: (headers, {getState}) => {
        const userToken = getState().auth.token;

        if (userToken) {
            headers.set('borttrivia-token', userToken);
        }

        return headers;
    },
    fetchFn: (input) => {
        // Don't bother sending editor requests we know will be rejected. Return
        // a real 401 Response rather than undefined, so the caller always has
        // something it can await and read a status off of.
        if (!input.headers.get('borttrivia-token')) {
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
        if (error.status === 401 || error.status === 403) {
            return false
        }
        return attempt <= 5
    },
})

export const mainApi = createApi({
    reducerPath: 'mainApi',
    baseQuery: baseQuery,
    endpoints: (builder) => ({
        getCollections: builder.query({
            query: () => ({url: `editor/collections`}),
            providesTags: ['collections']
        }),
        getCollection: builder.query({
            query: (id) => ({url: `editor/collections/${id}`}),
        }),
        createCollection: builder.mutation({
            query: (body) => ({
                url: `editor/collections`,
                method: "POST",
                body: body
            }),
            invalidatesTags: ['collections']
        }),
        deleteCollection: builder.mutation({
            query: (id) => ({
                url: `editor/collections/${id}`,
                method: "DELETE"
            }),
            invalidatesTags: ['collections']
        }),
        importCollection: builder.mutation({
            query: (id) => ({
                url: `editor/collections/${id}/import`,
                method: "POST"
            }),
        }),
        getQuestions: builder.query({
            query: (queryParams) => ({
                url: `editor/questions${queryParams ? queryParams : ""}`,
            }),
            providesTags: ["questions"]
        }),
        createQuestion: builder.mutation({
            query: (body) => ({
                url: `editor/question`,
                method: "POST",
                body: body
            }),
            invalidatesTags: ["questions"]
        }),
        updateQuestion: builder.mutation({
            query: (args) => ({
                url: `editor/question/${args.id}`,
                method: "PUT",
                body: args.body
            }),
            invalidatesTags: ["questions"]
        }),
        deleteQuestion: builder.mutation({
            query: (id) => ({
                url: `editor/question/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["questions"]
        }),
        getScoringNotes: builder.query({
            query: () => ({
                url: `editor/scoring_notes`,
            }),
            providesTags: ["scoring_notes"]
        }),
        getOneScoringNote: builder.query({
            query: (id) => ({
                url: `editor/scoring_notes/${id}`,
            }),
        }),
        createScoringNote: builder.mutation({
            query: (body) => ({
                url: `editor/scoring_notes`,
                method: "POST",
                body: body
            }),
            invalidatesTags: ["scoring_notes"]
        }),
        deleteScoringNote: builder.mutation({
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